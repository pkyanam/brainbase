import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { searchBrain, vectorSearchBrain, SearchResult } from "@/lib/supabase/search";
import { generateEmbeddings } from "@/lib/embeddings";
import { queryMany } from "@/lib/supabase/client";
import {
  rrfFusion,
  normalizeScores,
  applyCompiledTruthBoost,
  applyBacklinkBoost,
  dedupResults,
  classifyIntent,
  detailForIntent,
  QueryIntent,
} from "@/lib/supabase/hybrid";

export async function POST(req: NextRequest) {
  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    q?: string;
    limit?: number;
    detail?: "low" | "medium" | "high";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const q = body.q;
  if (!q || typeof q !== "string") {
    return NextResponse.json({ error: "Missing 'q' field" }, { status: 400 });
  }

  const limit = Math.min(Number(body.limit) || 20, 100);

  // Classify intent (zero-latency heuristic, no LLM)
  const intent: QueryIntent = classifyIntent(q);
  const detail = body.detail || detailForIntent(intent);

  try {
    // ── Phase 1: Parallel keyword + vector search ────────────────
    const keywordLimit = detail === "high" ? limit * 3 : limit * 2;
    const [keywordResults, embedding] = await Promise.all([
      searchBrain(auth.brainId, q, keywordLimit),
      generateEmbeddings([q]).then((e) => e?.[0] ?? null),
    ]);

    let vectorResults: SearchResult[] = [];
    if (embedding) {
      vectorResults = await vectorSearchBrain(
        auth.brainId,
        embedding,
        keywordLimit
      );
    }

    // ── Phase 2: RRF Fusion ─────────────────────────────────────
    const fused = rrfFusion([keywordResults, vectorResults]);

    // ── Phase 3: Normalize scores 0-1 ────────────────────────────
    const normed = normalizeScores(fused);

    // ── Phase 4: Compiled truth boost (2.0x for compiled_truth chunks)
    applyCompiledTruthBoost(normed);

    // ── Phase 5: Backlink boost ──────────────────────────────────
    const backlinks = await fetchBacklinks(
      auth.brainId,
      Array.from(normed.keys())
    );
    applyBacklinkBoost(normed, backlinks);

    // ── Phase 6: 4-layer dedup ───────────────────────────────────
    const allResults = flattenResults(normed);
    const deduped = dedupResults(allResults, {
      maxPerPage: detail === "high" ? 3 : 2,
      maxTypeFraction: 0.6,
    });

    // ── Phase 7: Sort by final score ─────────────────────────────
    deduped.sort((a, b) => b.score - a.score);
    const final = deduped.slice(0, limit).map((r) => ({
      slug: r.slug,
      title: r.title,
      type: r.type,
      excerpt: r.excerpt,
      score: Math.round(r.score * 100) / 100,
      source: r.source,
    }));

    return NextResponse.json({
      q,
      limit,
      intent,
      detail,
      results: final,
    });
  } catch (err) {
    console.error("[brainbase] /api/query POST error:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}

/** Flatten fused map into result array for dedup. */
function flattenResults(
  fused: Map<string, { score: number; results: SearchResult[] }>
): { slug: string; score: number; excerpt: string; type: string; source: string; title: string; chunk_source?: string }[] {
  const output: {
    slug: string;
    score: number;
    excerpt: string;
    type: string;
    source: string;
    title: string;
    chunk_source?: string;
  }[] = [];

  for (const [slug, entry] of fused) {
    for (const r of entry.results) {
      output.push({
        slug,
        score: entry.score, // fused score, not individual chunk score
        excerpt: r.excerpt,
        type: r.type,
        source: r.source,
        title: r.title,
        chunk_source: (r as any).chunk_source,
      });
    }
  }

  return output;
}

/** Fetch backlink counts for a set of slugs. */
async function fetchBacklinks(
  brainId: string,
  slugs: string[]
): Promise<Map<string, number>> {
  if (slugs.length === 0) return new Map();
  const rows = await queryMany<{ slug: string; count: string }>(
    `SELECT p.slug,
       COALESCE(lc.cnt, 0) as count
     FROM pages p
     LEFT JOIN (
       SELECT to_page_id as pid, COUNT(*) as cnt
       FROM links WHERE brain_id = $1
       GROUP BY to_page_id
     ) lc ON lc.pid = p.id
     WHERE p.brain_id = $1 AND p.slug = ANY($2)`,
    [brainId, slugs]
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.slug, parseInt(r.count) || 0);
  }
  return map;
}
