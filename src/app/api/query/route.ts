import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { searchBrain, vectorSearchBrain, expandQuery, SearchResult } from "@/lib/supabase/search";
import { generateEmbeddings } from "@/lib/embeddings";
import { queryMany } from "@/lib/supabase/client";
import {
  rrfFusion,
  dedupBySlug,
  pinExactMatches,
  forceExactMatchTop,
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
    const dedupedVector = dedupBySlug(vectorResults);

    // B2 FIX v2: Pin exact title/slug matches at rank 0 in each list
    const pinnedKeyword = pinExactMatches(keywordResults, q);
    const pinnedVector = pinExactMatches(dedupedVector, q);

    // ── Phase 2: RRF Fusion ─────────────────────────────────────
    const fused = rrfFusion([pinnedKeyword, pinnedVector]);

    // ── Phase 3: Normalize scores 0-1 ────────────────────────────
    const normed = normalizeScores(fused);

    // ── Phase 4: Compiled truth boost (1.15x)
    applyCompiledTruthBoost(normed);

    // ── Phase 5: Backlink boost ──────────────────────────────────
    const backlinks = await fetchBacklinks(
      auth.brainId,
      Array.from(normed.keys())
    );
    applyBacklinkBoost(normed, backlinks);

    // ── Phase 5.5: B2 FIX v3 — force exact matches to 100.0 BEFORE flattening.
    // Safety net: if pinExactMatches + RRF somehow lost the exact match,
    // this ensures it is in the fused map at max score.
    forceExactMatchTop(normed, q);

    // ── Phase 5.6: Parse tweet-specific query signals ────────────
    let ordinalMatch: OrdinalMatch | null = null;
    let dateRange: DateRangeMatch | null = null;

    if (intent === "tweet") {
      ordinalMatch = parseTweetOrdinal(q);
      dateRange = parseTweetDateRange(q);
      console.log("[query] Tweet intent detected:", { q, ordinalMatch, dateRange });
    }

    // ── Phase 6: Flatten → FINAL dedup by slug ──────────────────
    const allResults = flattenResults(normed);
    const finalResults = dedupBySlug(allResults);

    // ── Phase 6.5: Structured tweet handlers ─────────────────────
    if (intent === "tweet") {
      // ── Ordinal handler: "first tweet", "2000th tweet", etc. ──
      if (ordinalMatch) {
        console.log("[query] Ordinal handler running:", ordinalMatch);
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
          console.log("[query] Ordinal results:", ordinalResults.length, "rows");
          for (const r of ordinalResults) {
            const existing = finalResults.find((fr) => fr.slug === r.slug);
            const pinScore = 100.0;
            if (existing) {
              existing.score = Math.max(existing.score, pinScore);
              existing.excerpt = r.excerpt || existing.excerpt;
              if (!existing.boost_factors) existing.boost_factors = { total: 1.0 } as any;
              (existing.boost_factors as any).exact_match = pinScore;
              (existing.boost_factors as any).total = pinScore;
              (existing as any).handler_path = "ordinal";
            } else {
              finalResults.push({
                slug: r.slug,
                score: pinScore,
                excerpt: r.excerpt || "",
                type: r.type,
                source: "fts_and" as any,
                title: r.title,
                boost_factors: {
                  exact_match: pinScore,
                  total: pinScore,
                } as BoostFactors,
                handler_path: "ordinal",
              } as any);
            }
          }

          // Fallback: exact ordinal lookup empty → content search
          if (ordinalResults.length === 0 && ordinalMatch.mode === "exact") {
            console.log("[query] Ordinal fallback running for:", ordinalMatch.ordinal);
            try {
              const fallbackResults = await queryMany<{
                slug: string; title: string; type: string; excerpt: string;
              }>(
                `SELECT p.slug, p.title, p.type,
                        COALESCE(p.compiled_truth, '') as excerpt
                 FROM pages p
                 WHERE p.brain_id = $1
                   AND p.type = 'tweet'
                   AND (p.compiled_truth ILIKE $2 OR p.title ILIKE $2)
                 ORDER BY (frontmatter->>'ordinal')::int ASC
                 LIMIT 5`,
                [auth.brainId, `%${ordinalMatch.ordinal}%`]
              );
              console.log("[query] Ordinal fallback results:", fallbackResults.length, "rows");
              for (const r of fallbackResults) {
                const existing = finalResults.find((fr) => fr.slug === r.slug);
                const fallbackScore = 95.0;
                if (existing) {
                  existing.score = Math.max(existing.score, fallbackScore);
                  existing.excerpt = r.excerpt || existing.excerpt;
                  (existing as any).handler_path = "ordinal_fallback";
                } else {
                  finalResults.push({
                    slug: r.slug,
                    score: fallbackScore,
                    excerpt: r.excerpt || "",
                    type: r.type,
                    source: "fts_and" as any,
                    title: r.title,
                    boost_factors: { total: fallbackScore } as BoostFactors,
                    handler_path: "ordinal_fallback",
                  } as any);
                }
              }
            } catch (err) {
              console.error("[query] Ordinal fallback lookup error:", err);
            }
          }
        } catch (err) {
          console.error("[query] Ordinal tweet lookup error:", err);
        }
      }

      // ── Date-range handler: "tweets from 2014", etc. ──
      if (dateRange) {
        console.log("[query] Date handler running:", dateRange);
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
          console.log("[query] Date results:", dateResults.length, "rows, SQL:", conditions.join(" AND "));

          for (const r of dateResults) {
            const existing = finalResults.find((fr) => fr.slug === r.slug);
            const dateScore = 2.0;  // Pinned high — date-filtered results ARE the answer for date queries
            if (existing) {
              existing.score = Math.max(existing.score, dateScore);
              existing.excerpt = r.excerpt || existing.excerpt;
              (existing as any).handler_path = "date";
            } else {
              finalResults.push({
                slug: r.slug,
                score: dateScore,
                excerpt: r.excerpt || "",
                type: r.type,
                source: "fts_and" as any,
                title: r.title,
                boost_factors: { total: dateScore } as BoostFactors,
                handler_path: "date",
              } as any);
            }
          }
        } catch (err) {
          console.error("[query] Date-range tweet lookup error:", err);
        }
      }

      // ── Entity-mention handler: 3-pass fallback with tiered scoring ──
      const aboutMatch = q.match(/(?:tweets?\s+(?:about|on|mentioning|regarding|re|involving|referencing)\s+)(.+)/i);
      if (aboutMatch && aboutMatch[1]) {
        const entityName = aboutMatch[1].trim();
        console.log("[query] Entity-mention handler running for:", entityName);
        try {
          let mentionResults: Array<{ slug: string; title: string; type: string; excerpt: string }> = [];
          let mentionScore = 1.5;  // Pass 1: exact match → highest tier

          // Pass 1: exact entity name ILIKE + backlink tiebreaker
          mentionResults = await queryMany<{
            slug: string; title: string; type: string; excerpt: string;
          }>(
            `SELECT p.slug, p.title, p.type,
                    COALESCE(p.compiled_truth, '') as excerpt
             FROM pages p
             LEFT JOIN (
               SELECT to_page_id as pid, COUNT(*) as cnt
               FROM links WHERE brain_id = $1 GROUP BY to_page_id
             ) lc ON lc.pid = p.id
             WHERE p.brain_id = $1 AND p.type = 'tweet'
               AND (p.compiled_truth ILIKE $2 OR p.title ILIKE $2)
             ORDER BY COALESCE(lc.cnt, 0) DESC,
                      ts_rank_cd(to_tsvector('english', COALESCE(p.compiled_truth, '')), plainto_tsquery('english', $2)) DESC
             LIMIT 20`,
            [auth.brainId, `%${entityName}%`]
          );
          console.log("[query] Entity-mention pass 1 (exact):", mentionResults.length, "rows");

          // Pass 2: split into AND-search → mid tier + backlink tiebreaker
          if (mentionResults.length === 0 && entityName.includes(" ")) {
            mentionScore = 1.3;
            const words = entityName.split(/\s+/).filter(w => w.length > 1);
            if (words.length >= 2) {
              const ilikeClauses = words.map((_, i) =>
                `(p.compiled_truth ILIKE $${i + 2} OR p.title ILIKE $${i + 2})`
              );
              mentionResults = await queryMany<{
                slug: string; title: string; type: string; excerpt: string;
              }>(
                `SELECT p.slug, p.title, p.type, COALESCE(p.compiled_truth, '') as excerpt
                 FROM pages p
                 LEFT JOIN (
                   SELECT to_page_id as pid, COUNT(*) as cnt
                   FROM links WHERE brain_id = $1 GROUP BY to_page_id
                 ) lc ON lc.pid = p.id
                 WHERE p.brain_id = $1 AND p.type = 'tweet'
                   AND (${ilikeClauses.join(" AND ")})
                 ORDER BY COALESCE(lc.cnt, 0) DESC,
                          ts_rank_cd(to_tsvector('english', COALESCE(p.compiled_truth, '')), plainto_tsquery('english', $${words.length + 2})) DESC
                 LIMIT 20`,
                [auth.brainId, ...words.map(w => `%${w}%`), entityName]
              );
              console.log("[query] Entity-mention pass 2 (AND):", mentionResults.length, "rows");
            }
          }

          // Pass 3: no spaces → lowest tier + backlink tiebreaker
          if (mentionResults.length === 0 && entityName.includes(" ")) {
            mentionScore = 1.1;
            const noSpace = entityName.replace(/\s+/g, "");
            mentionResults = await queryMany<{
              slug: string; title: string; type: string; excerpt: string;
            }>(
              `SELECT p.slug, p.title, p.type, COALESCE(p.compiled_truth, '') as excerpt
               FROM pages p
               LEFT JOIN (
                 SELECT to_page_id as pid, COUNT(*) as cnt
                 FROM links WHERE brain_id = $1 GROUP BY to_page_id
               ) lc ON lc.pid = p.id
               WHERE p.brain_id = $1 AND p.type = 'tweet'
                 AND (p.compiled_truth ILIKE $2 OR p.title ILIKE $2)
               ORDER BY COALESCE(lc.cnt, 0) DESC,
                        ts_rank_cd(to_tsvector('english', COALESCE(p.compiled_truth, '')), plainto_tsquery('english', $2)) DESC
               LIMIT 20`,
              [auth.brainId, `%${noSpace}%`]
            );
            console.log("[query] Entity-mention pass 3 (no-space):", mentionResults.length, "rows");
          }

          if (mentionResults.length === 0) {
            console.log("[query] Entity-mention ALL PASSES zero for:", entityName);
          }

          // Inject with tiered score — pass 1 beats pass 2 beats pass 3 after boost
          for (const r of mentionResults) {
            const existing = finalResults.find((fr) => fr.slug === r.slug);
            if (existing) {
              existing.score = Math.max(existing.score, mentionScore);
              existing.excerpt = r.excerpt || existing.excerpt;
              (existing as any).handler_path = "entity_mention";
            } else {
              finalResults.push({
                slug: r.slug, score: mentionScore, excerpt: r.excerpt || "",
                type: r.type, source: "fts_and" as any, title: r.title,
                boost_factors: { total: mentionScore } as BoostFactors,
                handler_path: "entity_mention",
              } as any);
            }
          }
        } catch (err) {
          console.error("[query] Entity-mention tweet lookup error:", err);
        }
      }

      // ── Count handler: "how many tweets" ──
      if (/\b(how many tweets|tweet count|number of tweets|count of tweets|total tweets)\b/i.test(q)) {
        console.log("[query] Count handler running");
        try {
          const countRows = await queryMany<{ count: string }>(
            `SELECT COUNT(*)::text as count FROM pages
             WHERE brain_id = $1 AND type = 'tweet'`,
            [auth.brainId]
          );
          if (countRows.length > 0) {
            const tweetCount = parseInt(countRows[0].count, 10);
            console.log("[query] Tweet count:", tweetCount);
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
              handler_path: "count",
            } as any);
          }
        } catch (err) {
          console.error("[query] Tweet count lookup error:", err);
        }
      }
    }

    // ── Phase 7: Tweet-content retrieval fallback ────────────
    // MUST run BEFORE tweet boost so fallback rows get the multiplier.
    // For non-tweet-intent queries where hybrid returns few/no tweets,
    // search tweet content directly and inject with tiered scoring.
    if (intent !== "tweet") {
      const tweetResults = finalResults.filter(r => r.type === "tweet");
      if (tweetResults.length < 3) {
        console.log("[query] Tweet-content fallback: only", tweetResults.length, "tweets in results");
        try {
          const terms = q.split(/\s+/).filter(t => t.length > 2);
          if (terms.length >= 2) {
            // Tiered: require ALL terms, then fall back to >= 2 terms
            const ilikeAll = terms.map((_, i) =>
              `(p.compiled_truth ILIKE $${i + 2} OR p.title ILIKE $${i + 2})`
            );
            const allParams = terms.map(t => `%${t}%`);
            let fallbackResults = await queryMany<{
              slug: string; title: string; type: string; excerpt: string;
            }>(
              `SELECT p.slug, p.title, p.type, COALESCE(p.compiled_truth, '') as excerpt
               FROM pages p
               WHERE p.brain_id = $1 AND p.type = 'tweet'
                 AND (${ilikeAll.join(" AND ")})
               ORDER BY p.updated_at DESC LIMIT 10`,
              [auth.brainId, ...allParams]
            );
            let fallbackScore = 0.8;  // All terms match → highest tier
            console.log("[query] Fallback pass 1 (all terms):", fallbackResults.length, "rows");

            // If < 3 results with all terms, relax to >= 2 terms
            if (fallbackResults.length < 3 && terms.length >= 3) {
              // Use OR instead of AND, then filter client-side
              const ilikeOr = terms.map((_, i) =>
                `(p.compiled_truth ILIKE $${i + 2} OR p.title ILIKE $${i + 2})`
              );
              const orResults = await queryMany<{
                slug: string; title: string; type: string; excerpt: string;
              }>(
                `SELECT p.slug, p.title, p.type, COALESCE(p.compiled_truth, '') as excerpt
                 FROM pages p
                 WHERE p.brain_id = $1 AND p.type = 'tweet'
                   AND (${ilikeOr.join(" OR ")})
                 ORDER BY p.updated_at DESC LIMIT 20`,
                [auth.brainId, ...allParams]
              );
              // Filter to rows matching >= 2 terms (client-side)
              const multiMatch = orResults.filter(r => {
                const text = ((r.excerpt || "") + " " + (r.title || "")).toLowerCase();
                const matches = terms.filter(t => text.includes(t.toLowerCase()));
                return matches.length >= 2;
              });
              // Merge: keep all-term results, add multi-match results not already present
              const existingSlugs = new Set(fallbackResults.map(r => r.slug));
              for (const r of multiMatch) {
                if (!existingSlugs.has(r.slug)) {
                  fallbackResults.push(r);
                  existingSlugs.add(r.slug);
                }
              }
              fallbackScore = 0.5;  // Partial match → mid tier
              console.log("[query] Fallback pass 2 (>=2 terms): added", multiMatch.length, "rows, total:", fallbackResults.length);
            }

            for (const r of fallbackResults) {
              const existing = finalResults.find((fr) => fr.slug === r.slug);
              if (!existing) {
                finalResults.push({
                  slug: r.slug, score: fallbackScore, excerpt: r.excerpt || "",
                  type: r.type, source: "fts_and" as any, title: r.title,
                  boost_factors: { total: fallbackScore } as BoostFactors,
                  handler_path: "tweet_fallback",
                } as any);
              }
            }
          }
        } catch (err) {
          console.error("[query] Tweet-content fallback error:", err);
        }
      }
    }

    // ── Phase 7.5: Multi-entity fallback ────────────────
    // If results are empty and query looks like "X and Y" or "X or Y",
    // split into individual entity searches and merge.
    if (finalResults.length === 0) {
      const multiMatch = q.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:and|or)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)$/i);
      if (multiMatch) {
        const entity1 = multiMatch[1].trim();
        const entity2 = multiMatch[2].trim();
        console.log("[query] Multi-entity fallback:", entity1, "|", entity2);
        try {
          const [r1, r2] = await Promise.all([
            searchBrain(auth.brainId, entity1, 5),
            searchBrain(auth.brainId, entity2, 5),
          ]);
          for (const r of [...r1, ...r2]) {
            if (!finalResults.find(fr => fr.slug === r.slug)) {
              finalResults.push({
                slug: r.slug,
                score: r.score,
                excerpt: r.excerpt,
                type: r.type,
                source: r.source,
                title: r.title,
                boost_factors: { total: r.score } as BoostFactors,
                handler_path: "multi_entity",
              } as any);
            }
          }
        } catch (err) {
          console.error("[query] Multi-entity fallback error:", err);
        }
      }
    }

    // ── Phase 8: Tweet boost for ALL intents ─────────────────────
    // MUST run AFTER fallback so tweet_fallback rows get the multiplier.
    // Tweet intent: 2.5x. All other intents: 2.0x baseline.
    console.log("[query] Applying tweet boost, intent:", intent);
    applyTweetBoost(finalResults as any, intent);

    // ── Phase 9: Exact match pin + sort ──────────────────────────
    forceExactMatchTopFinal(finalResults, q);

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
      handler_path: (r as any).handler_path || null,
      pin: (r as any).boost_factors?.exact_match >= 90 || r.score >= 90,
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
