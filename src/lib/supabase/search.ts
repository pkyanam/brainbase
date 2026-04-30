import { queryMany } from "./client";

export interface SearchResult {
  slug: string;
  title: string;
  type: string;
  excerpt: string;
  score: number;
}

export async function searchBrain(
  brainId: string,
  query: string,
  limit = 20,
  writtenBy?: string
): Promise<SearchResult[]> {
  const sanitized = query.replace(/[^\w\s-]/g, "").trim();
  const writtenByClause = writtenBy ? "AND p.written_by = $4" : "";
  const writtenByParam = writtenBy ? [writtenBy] : [];

  try {
    const rows = await queryMany<{
      slug: string; title: string; type: string;
      excerpt: string; rank: number;
    }>(
      `SELECT p.slug, p.title, p.type,
              ts_headline('english', COALESCE(p.compiled_truth, ''), plainto_tsquery('english', $2),
                'MaxWords=40, MinWords=20, ShortWord=3, MaxFragments=2, FragmentDelimiter=...') as excerpt,
              ts_rank(p.search_vector, plainto_tsquery('english', $2)) as rank
       FROM pages p
       WHERE p.brain_id = $1 AND p.search_vector @@ plainto_tsquery('english', $2)
         ${writtenByClause}
       ORDER BY rank DESC
       LIMIT $3`,
      [brainId, sanitized, limit, ...writtenByParam]
    );

    if (rows.length > 0) {
      return rows.map(r => ({
        slug: r.slug,
        title: r.title,
        type: r.type || "unknown",
        excerpt: r.excerpt || "",
        score: Math.min(0.99, Number(r.rank) || 0.7),
      }));
    }

    const terms = sanitized.split(/\s+/).filter(t => t.length > 1);
    if (terms.length === 0) return [];

    const ilikeClauses = terms.map((_, i) =>
      `(p.title ILIKE $${i + 2} OR p.compiled_truth ILIKE $${i + 2})`
    );
    const params = terms.map(t => `%${t}%`);
    const wbClause = writtenBy ? `AND p.written_by = $${terms.length + 3}` : "";
    const wbParam = writtenBy ? [writtenBy] : [];

    const fallback = await queryMany<{
      slug: string; title: string; type: string; compiled_truth: string;
    }>(
      `SELECT p.slug, p.title, p.type, p.compiled_truth
       FROM pages p
       WHERE p.brain_id = $1 AND (${ilikeClauses.join(" OR ")})
         ${wbClause}
       LIMIT $${terms.length + 2 + (writtenBy ? 1 : 0)}`,
      [brainId, ...params, ...wbParam, limit]
    );

    return fallback.map((p, i) => {
      const titleLower = p.title?.toLowerCase() || "";
      const queryLower = query.toLowerCase();
      let score = 0.7 - i * 0.02;
      if (titleLower === queryLower) score = 0.99;
      else if (titleLower.startsWith(queryLower)) score = 0.9;
      else if (titleLower.includes(queryLower)) score = 0.8;

      const content = p.compiled_truth || "";
      const lower = content.toLowerCase();
      const idx = lower.indexOf(queryLower);
      let excerpt = "";
      if (idx >= 0) {
        const start = Math.max(0, idx - 60);
        const end = Math.min(content.length, idx + query.length + 100);
        excerpt = (start > 0 ? "..." : "") + content.slice(start, end).replace(/\n/g, " ").trim() + (end < content.length ? "..." : "");
      } else {
        excerpt = content.slice(0, 200).replace(/\n/g, " ");
      }

      return { slug: p.slug, title: p.title, type: p.type || "unknown", excerpt, score: Math.max(0.1, score) };
    });
  } catch (err) {
    console.error("[brainbase] Search error:", err);
    return [];
  }
}
