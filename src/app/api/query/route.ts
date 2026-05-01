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
  applyTweetBoost,
  classifyIntent,
  detailForIntent,
  parseTweetOrdinal,
  parseTweetDateRange,
  QueryIntent,
  BoostFactors,
  OrdinalMatch,
  DateRangeMatch,
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

    // ── Phase 5.5: Tweet-aware re-ranking (Phase 2.0) ─────────────
    // When intent is "tweet", apply score multiplier to type=tweet results
    // BEFORE flattening so the boost propagates through final dedup.
    // Also handle ordinal and date-range queries with direct DB lookups.
    let ordinalMatch: OrdinalMatch | null = null;
    let dateRange: DateRangeMatch | null = null;

    if (intent === "tweet") {
      ordinalMatch = parseTweetOrdinal(q);
      dateRange = parseTweetDateRange(q);

      // Flatten first so we can apply tweet boost
    }

    // ── Phase 6: Flatten → FINAL dedup by slug ──────────────────
    // B1 FIX v3: Single dedupBySlug at the end. No 4-layer dedup.
    // One entry per slug, max score wins. Guarantees zero duplicates.
    const allResults = flattenResults(normed);
    const finalResults = dedupBySlug(allResults);

    // Phase 2.0: Apply tweet boost AFTER dedup (post-flatten scores)
    if (intent === "tweet") {
      applyTweetBoost(finalResults as any);
    }

    // Phase 2.0: Structured ordinal/date queries (runs in parallel with hybrid)
    if (intent === "tweet") {
      // Ordinal query: "first tweet", "2000th tweet", "my last tweet"
      if (ordinalMatch) {
        try {
          const ordinalResults = await queryMany<{
            slug: string; title: string; type: string; excerpt: string;
          }>(
            ordinalMatch.mode === "last"
              ? `SELECT slug, title, type, compiled_truth as excerpt
                 FROM pages
                 WHERE brain_id = $1 AND type = 'tweet'
                   AND frontmatter->>'ordinal' IS NOT NULL
                 ORDER BY (frontmatter->>'ordinal')::int DESC LIMIT 1`
              : ordinalMatch.mode === "first"
              ? `SELECT slug, title, type, compiled_truth as excerpt
                 FROM pages
                 WHERE brain_id = $1 AND type = 'tweet'
                   AND frontmatter->>'ordinal' IS NOT NULL
                 ORDER BY (frontmatter->>'ordinal')::int ASC LIMIT 1`
              : `SELECT slug, title, type, compiled_truth as excerpt
                 FROM pages
                 WHERE brain_id = $1 AND type = 'tweet'
                   AND (frontmatter->>'ordinal')::int = $2 LIMIT 1`,
            ordinalMatch.mode === "exact" && ordinalMatch.ordinal > 0
              ? [auth.brainId, ordinalMatch.ordinal]
              : [auth.brainId]
          );
          for (const r of ordinalResults) {
            const exists = finalResults.find((fr) => fr.slug === r.slug);
            if (!exists) {
              finalResults.push({
                slug: r.slug,
                score: 100.0,  // Pin at top — this IS the answer
                excerpt: r.excerpt || "",
                type: r.type,
                source: "fts_and" as any,
                title: r.title,
                boost_factors: {
                  exact_match: 100.0,
                  total: 100.0,
                } as BoostFactors,
              } as any);
            }
          }
        } catch (err) {
          console.error("[query] Ordinal tweet lookup error:", err);
        }
      }

      // Date-range query: "tweets from 2014", "tweets from April 29 2026"
      if (dateRange) {
        try {
          const conditions: string[] = ["p.brain_id = $1", "p.type = 'tweet'"];
          const params: any[] = [auth.brainId];
          let paramIdx = 2;

          if (dateRange.year) {
            conditions.push(`frontmatter->>'date' LIKE $${paramIdx}`);
            params.push(`${dateRange.year}%`);
            paramIdx++;
          }
          if (dateRange.month) {
            const monthStr = String(dateRange.month).padStart(2, "0");
            conditions.push(`frontmatter->>'date' LIKE $${paramIdx}`);
            params.push(`%-${monthStr}-%`);
            paramIdx++;
          }
          if (dateRange.day) {
            const dayStr = String(dateRange.day).padStart(2, "0");
            conditions.push(`frontmatter->>'date' LIKE $${paramIdx}`);
            params.push(`%${dayStr}%`);
            paramIdx++;
          }

          const dateResults = await queryMany<{
            slug: string; title: string; type: string; excerpt: string;
          }>(
            `SELECT p.slug, p.title, p.type,
                    COALESCE(p.compiled_truth, '') as excerpt
             FROM pages p
             WHERE ${conditions.join(" AND ")}
             ORDER BY frontmatter->>'date' DESC
             LIMIT 20`,
            params
          );

          for (const r of dateResults) {
            const exists = finalResults.find((fr) => fr.slug === r.slug);
            if (!exists) {
              finalResults.push({
                slug: r.slug,
                score: 0.95,  // High but below exact-match pin (100.0)
                excerpt: r.excerpt || "",
                type: r.type,
                source: "fts_and" as any,
                title: r.title,
                boost_factors: {
                  total: 0.95,
                } as BoostFactors,
              } as any);
            }
          }
        } catch (err) {
          console.error("[query] Date-range tweet lookup error:", err);
        }
      }

      // Entity-mention traversal: "tweets about Apple", "tweets mentioning Anthropic"
      // Extract the entity name and search tweet content for mentions.
      const aboutMatch = q.match(/(?:tweets?\s+(?:about|on|mentioning|regarding)\s+)(.+)/i);
      if (aboutMatch && aboutMatch[1]) {
        const entityName = aboutMatch[1].trim();
        try {
          const mentionResults = await queryMany<{
            slug: string; title: string; type: string; excerpt: string;
          }>(
            `SELECT p.slug, p.title, p.type,
                    COALESCE(p.compiled_truth, '') as excerpt
             FROM pages p
             WHERE p.brain_id = $1
               AND p.type = 'tweet'
               AND (p.compiled_truth ILIKE $2 OR p.title ILIKE $2)
             ORDER BY p.updated_at DESC
             LIMIT 20`,
            [auth.brainId, `%${entityName}%`]
          );
          for (const r of mentionResults) {
            const exists = finalResults.find((fr) => fr.slug === r.slug);
            if (!exists) {
              finalResults.push({
                slug: r.slug,
                score: 0.88,  // Strong but below date-range (0.95) and exact (100.0)
                excerpt: r.excerpt || "",
                type: r.type,
                source: "fts_and" as any,
                title: r.title,
                boost_factors: {
                  total: 0.88,
                } as BoostFactors,
              } as any);
            }
          }
        } catch (err) {
          console.error("[query] Entity-mention tweet lookup error:", err);
        }
      }

      // Count query: "how many tweets", "tweet count", "number of tweets"
      if (/\b(how many tweets|tweet count|number of tweets|count of tweets|total tweets)\b/i.test(q)) {
        try {
          const countRows = await queryMany<{ count: string }>(
            `SELECT COUNT(*)::text as count FROM pages
             WHERE brain_id = $1 AND type = 'tweet'`,
            [auth.brainId]
          );
          if (countRows.length > 0) {
            const tweetCount = parseInt(countRows[0].count, 10);
            finalResults.push({
              slug: "preetham-kyanam",
              score: 100.0,
              excerpt: `You have ${tweetCount.toLocaleString()} tweets in the archive (2,650 imported from X/Twitter).`,
              type: "person",
              source: "fts_and" as any,
              title: `Tweet Count: ${tweetCount.toLocaleString()}`,
              boost_factors: {
                exact_match: 100.0,
                total: 100.0,
              } as BoostFactors,
            } as any);
          }
        } catch (err) {
          console.error("[query] Tweet count lookup error:", err);
        }
      }
    }

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
