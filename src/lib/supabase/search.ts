import { queryMany } from "./client";

export interface SearchResult {
  slug: string;
  title: string;
  type: string;
  excerpt: string;
  score: number;
  source: "fts_and" | "fts_or" | "fts_chunk" | "timeline" | "trgm_title" | "trgm_content" | "keyword" | "vector";
  /** Source label for the chunk (e.g., "compiled_truth"). Used by compiled truth boost + dedup. */
  chunk_source?: string;
}

/** Minimum score to include in results */
const MIN_SCORE = 0.35;

/** If best score is below this, trigger deeper fallbacks */
const WEAK_THRESHOLD = 0.25;

/** Minimum vector similarity (1 - cosine_distance) for a result to be meaningful.
 *  Below this threshold, vector results are noise — a generic page weakly matching
 *  everything. This stops the "agents/arlan magnet" where one dense page becomes
 *  the zero-signal fallback for every unrelated query. */
const VECTOR_MIN_SIMILARITY = 0.55;

/** Slugs to exclude from search (meta pages that quote query strings) */
const EXCLUDED_SLUGS = new Set(["projects/brainbase/search-quality-audit"]);

/** Synonym map for relationship and role terms (F3 fix) */
const SYNONYMS: Record<string, string[]> = {
  mom: ["mom", "mother", "parent"],
  mother: ["mom", "mother", "parent"],
  mum: ["mum", "mother", "parent"],
  dad: ["dad", "father", "parent"],
  father: ["dad", "father", "parent"],
  sister: ["sister", "sibling"],
  brother: ["brother", "sibling"],
  sibling: ["sister", "brother", "sibling"],
  cousin: ["cousin", "relative"],
  partner: ["partner", "spouse", "husband", "wife", "boyfriend", "girlfriend"],
  husband: ["husband", "spouse", "partner"],
  wife: ["wife", "spouse", "partner"],
  boyfriend: ["boyfriend", "partner"],
  girlfriend: ["girlfriend", "partner"],
  boss: ["boss", "manager", "supervisor", "lead"],
  manager: ["boss", "manager", "supervisor", "lead"],
  coworker: ["coworker", "colleague", "peer", "teammate"],
  colleague: ["coworker", "colleague", "peer", "teammate"],
  // Phase 1.6: Relational + agent synonyms
  agent: ["agent", "assistant", "ai", "helper"],
  assistant: ["agent", "assistant", "ai", "helper"],
  friend: ["friend", "buddy", "pal", "companion"],
  childhood: ["childhood", "school", "growing up", "family", "friends"],
  family: ["family", "relative", "kin", "household"],
  projects: ["projects", "side projects", "hack", "build"],
};

/** Alias map: short forms → full names. Used for query expansion. */
const ALIASES: Record<string, string> = {
  yc: "Y Combinator",
  uva: "University of Virginia",
  mit: "Massachusetts Institute of Technology",
  nyu: "New York University",
  ucla: "University of California Los Angeles",
  sf: "San Francisco",
  nyc: "New York City",
  la: "Los Angeles",
  // Phase 1.6: Relationship expansion for relational queries
  agents: "agent assistant",
  assistants: "agent assistant",
  childhood: "family friends school childhood",
  projects: "projects side-projects",
};

/**
 * Expand known aliases in the query.
 * "YC batch" → "Y Combinator batch", "UVA" → "University of Virginia"
 */
export function expandQuery(query: string): string {
  const words = query.split(/\s+/);
  const expanded = words.map((w) => {
    const key = w.toLowerCase().replace(/[^a-z]/g, "");
    return ALIASES[key] || w;
  });
  return expanded.join(" ");
}

function sanitize(query: string): string {
  return query.replace(/[^\w\s'-]/g, "").trim();
}

/**
 * Build an OR-mode tsquery string for broad recall with synonyms.
 * e.g. "my mom and sister" → "'mom' | 'mother' | 'parent' | 'sister' | 'sibling'"
 */
function buildOrTsQuery(query: string): string {
  const terms = sanitize(query)
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
  const all = new Set<string>();
  for (const term of terms) {
    all.add(term);
    const syns = SYNONYMS[term];
    if (syns) {
      for (const s of syns) all.add(s.toLowerCase());
    }
  }
  return Array.from(all)
    .map((t) => `'${t.replace(/'/g, "''")}'`)
    .join(" | ");
}

function makeExcerpt(content: string | null, query: string): string {
  if (!content) return "";
  const lower = content.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx >= 0) {
    const start = Math.max(0, idx - 60);
    const end = Math.min(content.length, idx + query.length + 100);
    return (
      (start > 0 ? "..." : "") +
      content.slice(start, end).replace(/\n/g, " ").trim() +
      (end < content.length ? "..." : "")
    );
  }
  return content.slice(0, 200).replace(/\n/g, " ").trim() + (content.length > 200 ? "..." : "");
}

/**
 * Multi-stage semantic search for Brainbase.
 *
 * Stages:
 *  1. Pages — AND-mode FTS (strict, high precision)
 *  2. Pages — OR-mode FTS with synonyms (broad recall, F3)
 *  3. Chunks — OR-mode FTS (supplemental)
 *  4. Timeline — OR-mode FTS (F4, always merged)
 *  5. Title — pg_trgm similarity (F2 typo tolerance, always merged)
 *  6. Content — pg_trgm similarity (gated)
 *  7. Keyword — ILIKE fallback (last resort)
 *
 * No artificial score ladders (F1). Minimum cutoff 0.35 (F6).
 * Ties broken by link_count DESC, updated_at DESC (F5).
 */
export async function searchBrain(
  brainId: string,
  query: string,
  limit = 20,
  writtenBy?: string
): Promise<SearchResult[]> {
  const rawQuery = query;
  const orTsQuery = buildOrTsQuery(query);
  const wbClause = writtenBy ? "AND p.written_by = $4" : "";
  const wbParam = writtenBy ? [writtenBy] : [];
  const results = new Map<string, SearchResult>();
  let bestScore = 0;

  const addResult = (
    slug: string,
    title: string,
    type: string,
    excerpt: string,
    score: number,
    source: SearchResult["source"],
    chunk_source?: string
  ) => {
    if (EXCLUDED_SLUGS.has(slug)) return;
    const existing = results.get(slug);
    if (!existing || score > existing.score) {
      if (score > bestScore) bestScore = score;
      results.set(slug, { slug, title, type: type || "unknown", excerpt, score, source, chunk_source });
    }
  };

  // ── Stage 1: Pages — AND-mode FTS (primary) ──────────────────
  try {
    const rows = await queryMany<{
      slug: string;
      title: string;
      type: string;
      excerpt: string;
      rank: number;
    }>(
      `SELECT p.slug, p.title, p.type,
        ts_headline('english', COALESCE(p.compiled_truth, ''),
          plainto_tsquery('english', $2),
          'MaxWords=40, MinWords=20, ShortWord=3, MaxFragments=2, FragmentDelimiter=...') as excerpt,
        ts_rank_cd(p.search_vector, plainto_tsquery('english', $2), 32) as rank
       FROM pages p
       WHERE p.brain_id = $1 AND p.search_vector @@ plainto_tsquery('english', $2)
         ${wbClause}
       ORDER BY rank DESC
       LIMIT $3`,
      [brainId, rawQuery, limit, ...wbParam]
    );
    for (const r of rows) {
      addResult(r.slug, r.title, r.type, r.excerpt || "", Math.min(1.0, Number(r.rank) || 0), "fts_and");
    }
  } catch (err) {
    console.error("[search] Stage 1 error:", err);
  }

  // ── Stage 2: Pages — OR-mode FTS with synonyms (broad recall) ──────
  if (bestScore < WEAK_THRESHOLD) {
    try {
      const rows = await queryMany<{
        slug: string;
        title: string;
        type: string;
        excerpt: string;
        rank: number;
      }>(
        `SELECT p.slug, p.title, p.type,
          ts_headline('english', COALESCE(p.compiled_truth, ''),
            to_tsquery('english', $2),
            'MaxWords=40, MinWords=20, ShortWord=3, MaxFragments=2, FragmentDelimiter=...') as excerpt,
          ts_rank_cd(p.search_vector, to_tsquery('english', $2), 32) as rank
         FROM pages p
         WHERE p.brain_id = $1 AND p.search_vector @@ to_tsquery('english', $2)
           ${wbClause}
         ORDER BY rank DESC
         LIMIT $3`,
        [brainId, orTsQuery, limit, ...wbParam]
      );
      for (const r of rows) {
        addResult(r.slug, r.title, r.type, r.excerpt || "", Math.min(1.0, Number(r.rank) || 0) * 0.95, "fts_or");
      }
    } catch (err) {
      console.error("[search] Stage 2 error:", err);
    }
  }

  // ── Stage 3: Content chunks — OR-mode FTS (supplemental) ─────────
  if (bestScore < WEAK_THRESHOLD) {
    try {
      const rows = await queryMany<{
        slug: string;
        title: string;
        type: string;
        excerpt: string;
        rank: number;
      }>(
        `SELECT p.slug, p.title, p.type,
          ts_headline('english', c.chunk_text,
            to_tsquery('english', $2),
            'MaxWords=40, MinWords=20, ShortWord=3, MaxFragments=2, FragmentDelimiter=...') as excerpt,
          ts_rank_cd(c.search_vector, to_tsquery('english', $2), 32) * 0.9 as rank
         FROM content_chunks c
         JOIN pages p ON p.id = c.page_id
         WHERE c.brain_id = $1 AND c.search_vector @@ to_tsquery('english', $2)
           ${writtenBy ? "AND p.written_by = $4" : ""}
         ORDER BY rank DESC
         LIMIT $3`,
        [brainId, orTsQuery, limit, ...wbParam]
      );
      for (const r of rows) {
        addResult(r.slug, r.title, r.type, r.excerpt || "", Math.min(1.0, Number(r.rank) || 0), "fts_chunk");
      }
    } catch (err) {
      console.error("[search] Stage 3 error:", err);
    }
  }

  // ── Stage 4: Timeline entries — OR-mode FTS (always merged) ────────
  try {
    const rows = await queryMany<{
      slug: string;
      title: string;
      type: string;
      excerpt: string;
      rank: number;
    }>(
      `SELECT p.slug, p.title, p.type,
        t.summary as excerpt,
        ts_rank_cd(
          to_tsvector('english', COALESCE(t.summary, '') || ' ' || COALESCE(t.detail, '')),
          to_tsquery('english', $2),
          32
        ) * 0.9 as rank
       FROM timeline_entries t
       JOIN pages p ON p.id = t.page_id
       WHERE t.brain_id = $1
         AND to_tsvector('english', COALESCE(t.summary, '') || ' ' || COALESCE(t.detail, ''))
             @@ to_tsquery('english', $2)
       ORDER BY rank DESC
       LIMIT $3`,
      [brainId, orTsQuery, limit]
    );
    for (const r of rows) {
      addResult(r.slug, r.title, r.type, r.excerpt || "", Math.min(1.0, Number(r.rank) || 0), "timeline");
    }
  } catch (err) {
    console.error("[search] Stage 4 error:", err);
  }

  // ── Stage 5: pg_trgm title similarity (always merged for typo tolerance) ──
  try {
    const rows = await queryMany<{
      slug: string;
      title: string;
      type: string;
      compiled_truth: string;
      sim: number;
    }>(
      `SELECT slug, title, type, compiled_truth,
        similarity(title, $2) as sim
       FROM pages
       WHERE brain_id = $1 AND title % $2
         ${writtenBy ? "AND written_by = $4" : ""}
       ORDER BY sim DESC
       LIMIT $3`,
      [brainId, rawQuery, limit, ...wbParam]
    );
    for (const r of rows) {
      addResult(
        r.slug,
        r.title,
        r.type,
        makeExcerpt(r.compiled_truth, rawQuery),
        Math.min(1.0, Number(r.sim) || 0),
        "trgm_title"
      );
    }
  } catch (err) {
    console.error("[search] Stage 5 error:", err);
  }

  // ── Stage 6: pg_trgm content similarity (gated) ────────────────────
  if (bestScore < WEAK_THRESHOLD) {
    try {
      const rows = await queryMany<{
        slug: string;
        title: string;
        type: string;
        compiled_truth: string;
        sim: number;
      }>(
        `SELECT slug, title, type, compiled_truth,
          similarity(compiled_truth, $2) as sim
         FROM pages
         WHERE brain_id = $1 AND compiled_truth % $2
           ${writtenBy ? "AND written_by = $4" : ""}
         ORDER BY sim DESC
         LIMIT $3`,
        [brainId, rawQuery, limit, ...wbParam]
      );
      for (const r of rows) {
        addResult(
          r.slug,
          r.title,
          r.type,
          makeExcerpt(r.compiled_truth, rawQuery),
          Math.min(1.0, Number(r.sim) || 0) * 0.95,
          "trgm_content"
        );
      }
    } catch (err) {
      console.error("[search] Stage 6 error:", err);
    }
  }

  // ── Stage 7: Keyword ILIKE fallback (last resort) ───────────────
  if (results.size === 0) {
    const terms = sanitize(rawQuery)
      .split(/\s+/)
      .filter((t) => t.length > 1);
    if (terms.length > 0) {
      try {
        const ilikeClauses = terms.map((_, i) =>
          `(p.title ILIKE $${i + 2} OR p.compiled_truth ILIKE $${i + 2})`
        );
        const params = terms.map((t) => `%${t}%`);
        const wbClause2 = writtenBy ? `AND p.written_by = $${terms.length + 3}` : "";
        const wbParam2 = writtenBy ? [writtenBy] : [];

        const fallback = await queryMany<{
          slug: string;
          title: string;
          type: string;
          compiled_truth: string;
        }>(
          `SELECT p.slug, p.title, p.type, p.compiled_truth
           FROM pages p
           WHERE p.brain_id = $1 AND (${ilikeClauses.join(" OR ")})
             ${wbClause2}
           ORDER BY LENGTH(p.compiled_truth) DESC
           LIMIT $${terms.length + 2 + (writtenBy ? 1 : 0)}`,
          [brainId, ...params, ...wbParam2, limit]
        );

        for (const p of fallback) {
          const titleLower = p.title?.toLowerCase() || "";
          const queryLower = rawQuery.toLowerCase();
          let score = 0.5;
          if (titleLower === queryLower) score = 0.99;
          else if (titleLower.startsWith(queryLower)) score = 0.9;
          else if (titleLower.includes(queryLower)) score = 0.8;
          else if ((p.compiled_truth || "").toLowerCase().includes(queryLower)) score = 0.6;

          addResult(
            p.slug,
            p.title,
            p.type,
            makeExcerpt(p.compiled_truth, rawQuery),
            Math.max(0.1, score),
            "keyword"
          );
        }
      } catch (err) {
        console.error("[search] Stage 7 error:", err);
      }
    }
  }

  // ── Final assembly: threshold, dedupe, tie-break, sort ────────────
  let output = Array.from(results.values())
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.slug.localeCompare(b.slug);
    });

  // F5: Tie-breaking by link_count DESC, updated_at DESC
  if (output.length > 1) {
    const slugs = output.map((r) => r.slug);
    try {
      const metaRows = await queryMany<{
        slug: string;
        link_count: number;
        updated_at: string;
      }>(
        `SELECT p.slug,
          COALESCE(lc.cnt, 0) as link_count,
          p.updated_at::text
         FROM pages p
         LEFT JOIN (
           SELECT from_page_id as pid, COUNT(*) as cnt FROM links WHERE brain_id = $1 GROUP BY from_page_id
           UNION ALL
           SELECT to_page_id as pid, COUNT(*) as cnt FROM links WHERE brain_id = $1 GROUP BY to_page_id
         ) lc ON lc.pid = p.id
         WHERE p.brain_id = $1 AND p.slug = ANY($2)`,
        [brainId, slugs]
      );
      const metaMap = new Map(metaRows.map((r) => [r.slug, r]));

      output.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const ma = metaMap.get(a.slug);
        const mb = metaMap.get(b.slug);
        const lcDiff = (mb?.link_count || 0) - (ma?.link_count || 0);
        if (lcDiff !== 0) return lcDiff;
        return (mb?.updated_at || "").localeCompare(ma?.updated_at || "");
      });
    } catch {
      // keep score-only sort
    }
  }

  return output.slice(0, limit);
}

export async function vectorSearchBrain(
  brainId: string,
  queryEmbedding: number[],
  limit = 10
): Promise<SearchResult[]> {
  const rows = await queryMany<{
    slug: string;
    title: string;
    type: string;
    chunk_text: string;
    chunk_source: string;
    distance: number;
  }>(
    `SELECT p.slug, p.title, p.type, c.chunk_text, c.chunk_source,
            c.embedding <=> $2::vector as distance
     FROM content_chunks c
     JOIN pages p ON p.id = c.page_id
     WHERE c.brain_id = $1
     ORDER BY c.embedding <=> $2::vector
     LIMIT $3`,
    [brainId, JSON.stringify(queryEmbedding), limit]
  );

  return rows
    .map((r) => ({
      slug: r.slug,
      title: r.title,
      type: r.type,
      excerpt: r.chunk_text.slice(0, 200) + (r.chunk_text.length > 200 ? "..." : ""),
      score: Math.max(0, 1 - r.distance),
      source: "vector" as const,
      chunk_source: r.chunk_source || undefined,
    }))
    .filter((r) => r.score >= VECTOR_MIN_SIMILARITY);
}
