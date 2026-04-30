import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { searchBrain, vectorSearchBrain, expandQuery, SearchResult } from "@/lib/supabase/search";
import { generateEmbeddings } from "@/lib/embeddings";
import { queryMany } from "@/lib/supabase/client";
import {
  rrfFusion,
  dedupBySlug,
  pinExactMatches,
  forceExactMatchTopFinal,
  normalizeScores,
  applyCompiledTruthBoost,
  applyBacklinkBoost,
  classifyIntent,
  detailForIntent,
  QueryIntent,
  BoostFactors,
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
  // B5 FIX: empty q returns 200 with empty results, not 400
  if (!q || typeof q !== "string" || q.trim().length === 0) {
    return NextResponse.json({
      q: q || "",
      limit: body.limit || 20,
      intent: null,
      detail: null,
      results: [],
    });
  }

  const limit = Math.min(Number(body.limit) || 20, 100);

  // Classify intent (zero-latency heuristic, no LLM)
  const intent: QueryIntent = classifyIntent(q);
  const detail = body.detail || detailForIntent(intent);

  try {
    // ── Phase 1: Parallel keyword + vector search ────────────────
    const keywordLimit = detail === "high" ? limit * 3 : limit * 2;

    // Expand aliases: "YC" → "Y Combinator", "UVA" → "University of Virginia"
    const expandedQ = expandQuery(q);

    const [keywordResults, embedding] = await Promise.all([
      searchBrain(auth.brainId, q, keywordLimit),
      generateEmbeddings([expandedQ]).then((e) => e?.[0] ?? null),
    ]);

    let vectorResults: SearchResult[] = [];
    if (embedding) {
      vectorResults = await vectorSearchBrain(
        auth.brainId,
        embedding,
        keywordLimit
      );
    }

    // B1 FIX: Dedup vector results by slug BEFORE RRF.
    // Vector search returns one row per chunk — multiple rows per page.
    // Collapse to one per slug (max score) so RRF doesn't get flooded.
    const dedupedVector = dedupBySlug(vectorResults);

    // B2 FIX v2: Pin exact title/slug matches at rank 0 in each list
    // so they get maximum RRF contribution from every list.
    const pinnedKeyword = pinExactMatches(keywordResults, q);
    const pinnedVector = pinExactMatches(dedupedVector, q);

    // ── Phase 2: RRF Fusion ─────────────────────────────────────
    const fused = rrfFusion([pinnedKeyword, pinnedVector]);

    // ── Phase 3: Normalize scores 0-1 ────────────────────────────
    const normed = normalizeScores(fused);

    // ── Phase 4: Compiled truth boost (1.15x, subtle — avoid artificial ceiling)
    applyCompiledTruthBoost(normed);

    // ── Phase 5: Backlink boost ──────────────────────────────────
    const backlinks = await fetchBacklinks(
      auth.brainId,
      Array.from(normed.keys())
    );
    applyBacklinkBoost(normed, backlinks);

    // ── Phase 6: Flatten → FINAL dedup by slug ──────────────────
    // B1 FIX v3: Single dedupBySlug at the end. No 4-layer dedup.
    // One entry per slug, max score wins. Guarantees zero duplicates.
    const allResults = flattenResults(normed);
    const finalResults = dedupBySlug(allResults);

    // B2 FIX v2: Force exact-match pages to score 100.0 (AFTER dedup)
    // This ensures exact matches are ALWAYS #1, period.
    forceExactMatchTopFinal(finalResults, q);

    // ── Phase 7: Sort + slice ────────────────────────────────────
    finalResults.sort((a, b) => b.score - a.score);
    const final = finalResults.slice(0, limit).map((r) => ({
      slug: r.slug,
      title: r.title,
      type: r.type,
      excerpt: r.excerpt,
      score: Math.round(r.score * 100) / 100,
      source: r.source,
      chunk_source: (r as any).chunk_source || null,
      boost_factors: (r as any).boost_factors || null,
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

/**
 * Flatten fused map into result array for dedup.
 * B4 FIX: carries boost_factors through from fused map entries.
 */
function flattenResults(
  fused: Map<
    string,
    {
      score: number;
      results: SearchResult[];
      boost_factors?: BoostFactors;
    }
  >
): Array<{
  slug: string;
  score: number;
  excerpt: string;
  type: string;
  source: string;
  title: string;
  chunk_source?: string;
  boost_factors?: BoostFactors;
}> {
  const output: Array<{
    slug: string;
    score: number;
    excerpt: string;
    type: string;
    source: string;
    title: string;
    chunk_source?: string;
    boost_factors?: BoostFactors;
  }> = [];

  for (const [slug, entry] of fused) {
    for (const r of entry.results) {
      output.push({
        slug,
        score: entry.score,
        excerpt: r.excerpt,
        type: r.type,
        source: r.source,
        title: r.title,
        chunk_source: (r as any).chunk_source,
        boost_factors: entry.boost_factors,
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
