import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { searchBrain, vectorSearchBrain, SearchResult } from "@/lib/supabase/search";
import { generateEmbeddings } from "@/lib/embeddings";

export async function POST(req: NextRequest) {
  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { q?: string; limit?: number };
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

  try {
    const [keywordResults, embedding] = await Promise.all([
      searchBrain(auth.brainId, q, limit),
      generateEmbeddings([q]).then((e) => e?.[0] ?? null),
    ]);

    let vectorResults: SearchResult[] = [];
    if (embedding) {
      vectorResults = await vectorSearchBrain(auth.brainId, embedding, limit);
    }

    // Merge and dedupe by slug, keeping highest score
    const merged = new Map<string, SearchResult>();
    for (const r of keywordResults) {
      merged.set(r.slug, r);
    }
    for (const r of vectorResults) {
      const existing = merged.get(r.slug);
      if (!existing || r.score > existing.score) {
        merged.set(r.slug, {
          ...r,
          score: Math.max(r.score, existing?.score ?? 0),
        });
      }
    }

    const results = Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return NextResponse.json({ q, limit, results });
  } catch (err) {
    console.error("[brainbase] /api/query POST error:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
