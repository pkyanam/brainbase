/**
 * Semantic auto-linking for Brainbase.
 * After a page gets embeddings, finds semantically similar pages
 * and auto-creates links between them.
 */

import { query, queryOne, queryMany } from "./supabase/client";

const SIMILARITY_THRESHOLD = 0.78; // Cosine similarity — tune this
const MAX_AUTO_LINKS = 5; // Don't spam links

interface SimilarPage {
  slug: string;
  title: string;
  similarity: number;
}

/**
 * Find pages semantically similar to the given page using pgvector.
 * Uses average embedding of all chunks for the page.
 */
export async function findSimilarPages(
  brainId: string,
  pageSlug: string,
  excludePageIds: number[] = []
): Promise<SimilarPage[]> {
  // Get the page's id
  const pageRow = await queryOne<{ id: number }>(
    `SELECT id FROM pages WHERE brain_id = $1 AND slug = $2`,
    [brainId, pageSlug]
  );
  if (!pageRow) return [];

  // Compute average embedding for this page's chunks
  const avgEmbedding = await queryOne<{ embedding: string }>(
    `SELECT AVG(embedding)::vector AS embedding
     FROM content_chunks
     WHERE brain_id = $1 AND page_id = $2 AND embedding IS NOT NULL`,
    [brainId, pageRow.id]
  );
  if (!avgEmbedding?.embedding) return [];

  // Find similar pages via vector similarity
  // Exclude self and already-linked pages
  const excludeList = [pageRow.id, ...excludePageIds];

  const rows = await queryMany<{ slug: string; title: string; similarity: number }>(
    `WITH page_avg AS (
       SELECT AVG(embedding)::vector AS emb
       FROM content_chunks
       WHERE brain_id = $1 AND page_id = $2 AND embedding IS NOT NULL
     )
     SELECT p.slug, p.title,
       1 - (AVG(c.embedding) <=> (SELECT emb FROM page_avg)) AS similarity
     FROM content_chunks c
     JOIN pages p ON p.id = c.page_id AND p.brain_id = c.brain_id
     WHERE c.brain_id = $1
       AND c.page_id != ALL($3)
       AND c.embedding IS NOT NULL
     GROUP BY p.id, p.slug, p.title
     HAVING 1 - (AVG(c.embedding) <=> (SELECT emb FROM page_avg)) > $4
     ORDER BY similarity DESC
     LIMIT $5`,
    [brainId, pageRow.id, excludeList, SIMILARITY_THRESHOLD, MAX_AUTO_LINKS]
  );

  return rows.map(r => ({
    slug: r.slug,
    title: r.title,
    similarity: Math.round(r.similarity * 1000) / 1000,
  }));
}

/**
 * Create semantic links from a page to similar pages.
 * Returns list of created links.
 */
export async function createSemanticLinks(
  brainId: string,
  fromSlug: string,
  context?: string
): Promise<{ to: string; similarity: number }[]> {
  // Find existing links to avoid duplicates
  const fromPage = await queryOne<{ id: number }>(
    `SELECT id FROM pages WHERE brain_id = $1 AND slug = $2`,
    [brainId, fromSlug]
  );
  if (!fromPage) return [];

  const existingLinks = await queryMany<{ to_page_id: number }>(
    `SELECT to_page_id FROM links WHERE brain_id = $1 AND from_page_id = $2`,
    [brainId, fromPage.id]
  );
  const excludeIds = existingLinks.map(e => e.to_page_id);

  const similar = await findSimilarPages(brainId, fromSlug, excludeIds);
  if (similar.length === 0) return [];

  const created: { to: string; similarity: number }[] = [];

  for (const page of similar) {
    const toPage = await queryOne<{ id: number }>(
      `SELECT id FROM pages WHERE brain_id = $1 AND slug = $2`,
      [brainId, page.slug]
    );
    if (!toPage) continue;

    await query(
      `INSERT INTO links (brain_id, from_page_id, to_page_id, link_type, context)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [brainId, fromPage.id, toPage.id, "semantic", context || `Similarity: ${page.similarity}`]
    );
    created.push({ to: page.slug, similarity: page.similarity });
  }

  console.log(`[brainbase] Created ${created.length} semantic links from ${fromSlug}`);
  return created;
}
