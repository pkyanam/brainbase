/**
 * Batch orphan linker v2 — vector similarity + FTS fallback.
 *
 * Replaces the one-at-a-time semantic linker with a single bulk query.
 * Strategy:
 *   1. For orphans WITH embeddings: find top-3 most similar connected pages via pgvector
 *   2. For orphans WITHOUT embeddings: fall back to FTS text matching
 *   3. Bulk-insert all discovered links in one transaction
 */

import { query, queryOne, queryMany } from "./supabase/client";

const VECTOR_THRESHOLD = 0.45; // cosine similarity (lowered from 0.65 — too strict for cross-domain orphans)
const FTS_RANK_THRESHOLD = 0.01; // ts_rank minimum (lowered from 0.05)
const MAX_LINKS_PER_ORPHAN = 3;

interface LinkPair {
  fromId: number;
  toId: number;
  similarity: number;
  method: "vector" | "fts";
}

/**
 * Link orphans using vector similarity on their average chunk embeddings.
 * Only matches against pages that already have links (are "connected").
 */
async function vectorLinkOrphans(
  brainId: string
): Promise<{ linked: number; pairs: LinkPair[]; sampleScores: number[] }> {
  // Get orphans that have at least one embedded chunk
  const orphanRows = await queryMany<{ id: number; slug: string }>(
    `SELECT p.id, p.slug
     FROM pages p
     WHERE p.brain_id = $1
       AND EXISTS (SELECT 1 FROM content_chunks c WHERE c.page_id = p.id AND c.brain_id = $1 AND c.embedding IS NOT NULL)
       AND NOT EXISTS (
         SELECT 1 FROM links l
         WHERE l.brain_id = $1
           AND (l.from_page_id = p.id OR l.to_page_id = p.id)
       )
     LIMIT 500`,
    [brainId]
  );

  if (orphanRows.length === 0) { console.log("[orphan-linker] No orphans with embeddings found"); return { linked: 0, pairs: [], sampleScores: [] }; }
  console.log(`[orphan-linker] Found ${orphanRows.length} orphans with embeddings, checking vector similarity...`);

  const pairs: LinkPair[] = [];

  // Diagnostic: sample a few raw similarity scores at lower threshold
  let sampleScores: number[] = [];
  if (orphanRows.length > 0) {
    const sampleOrphan = orphanRows[0];
    try {
      const sampleMatches = await queryMany<{ similarity: number }>(
        `WITH orphan_avg AS (
           SELECT AVG(embedding)::vector as emb
           FROM content_chunks
           WHERE brain_id = $1 AND page_id = $2 AND embedding IS NOT NULL
         ),
         target_avgs AS (
           SELECT p.id,
             AVG(c.embedding)::vector as emb
           FROM pages p
           JOIN content_chunks c ON c.page_id = p.id AND c.brain_id = p.brain_id
           WHERE p.brain_id = $1
             AND p.id != $2
             AND c.embedding IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM links l
               WHERE l.brain_id = $1
                 AND (l.from_page_id = p.id OR l.to_page_id = p.id)
             )
           GROUP BY p.id
         )
         SELECT 1 - (t.emb <=> (SELECT emb FROM orphan_avg)) as similarity
         FROM target_avgs t
         ORDER BY similarity DESC
         LIMIT 5`,
        [brainId, sampleOrphan.id]
      );
      sampleScores = sampleMatches.map(m => m.similarity);
      console.log(`[orphan-linker] Sample orphan ${sampleOrphan.slug}: top-5 similarities = [${sampleScores.join(', ')}]`);
    } catch (err) {
      console.error(`[orphan-linker] Sample query error:`, err);
      sampleScores = [-99]; // sentinel for error
    }
  }
  let checkedOrphans = 0;
  let totalMatches = 0;
  let topScores: number[] = [];
  
  for (const orphan of orphanRows) {
    // Find similar connected pages via vector
    const matches = await queryMany<{ id: number; slug: string; similarity: number }>(
      `WITH orphan_avg AS (
         SELECT AVG(embedding)::vector as emb
         FROM content_chunks
         WHERE brain_id = $1 AND page_id = $2 AND embedding IS NOT NULL
       ),
       target_avgs AS (
         SELECT p.id, p.slug,
           AVG(c.embedding)::vector as emb
         FROM pages p
         JOIN content_chunks c ON c.page_id = p.id AND c.brain_id = p.brain_id
         WHERE p.brain_id = $1
           AND p.id != $2
           AND c.embedding IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM links l
             WHERE l.brain_id = $1
               AND (l.from_page_id = p.id OR l.to_page_id = p.id)
           )
         GROUP BY p.id, p.slug
       )
       SELECT t.id, t.slug,
         1 - (t.emb <=> (SELECT emb FROM orphan_avg)) as similarity
       FROM target_avgs t
       WHERE 1 - (t.emb <=> (SELECT emb FROM orphan_avg)) > $3
       ORDER BY similarity DESC
       LIMIT $4`,
      [brainId, orphan.id, VECTOR_THRESHOLD, MAX_LINKS_PER_ORPHAN]
    );

    checkedOrphans++;
    totalMatches += matches.length;
    if (matches.length > 0 && topScores.length < 10) {
      topScores.push(matches[0].similarity);
    }

    for (const m of matches) {
      pairs.push({
        fromId: orphan.id,
        toId: m.id,
        similarity: m.similarity,
        method: "vector",
      });
    }
  }
  
  console.log(`[orphan-linker] Vector: checked ${checkedOrphans} orphans, found ${totalMatches} total matches, top scores: [${topScores.join(', ')}]`);

  return { linked: orphanRows.length, pairs, sampleScores };
}

/**
 * Link orphans using FTS text matching.
 * For orphans that don't have embeddings yet.
 */
async function ftsLinkOrphans(
  brainId: string
): Promise<{ linked: number; pairs: LinkPair[] }> {
  // Single batch query using FTS
  const rows = await queryMany<{
    orphan_id: number;
    target_id: number;
    rank: number;
  }>(
    `WITH orphans AS (
       SELECT p.id, p.search_vector
       FROM pages p
       WHERE p.brain_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM content_chunks c
           WHERE c.page_id = p.id AND c.brain_id = $1 AND c.embedding IS NOT NULL
         )
         AND NOT EXISTS (
           SELECT 1 FROM links l
           WHERE l.brain_id = $1
             AND (l.from_page_id = p.id OR l.to_page_id = p.id)
         )
         AND p.search_vector IS NOT NULL
         AND p.search_vector != to_tsvector('english', '')
       LIMIT 500
     ),
     connected AS (
       SELECT p.id, p.search_vector
       FROM pages p
       WHERE p.brain_id = $1
         AND p.search_vector IS NOT NULL
         AND p.search_vector != to_tsvector('english', '')
         AND EXISTS (
           SELECT 1 FROM links l
           WHERE l.brain_id = $1
             AND (l.from_page_id = p.id OR l.to_page_id = p.id)
         )
     ),
     ranked AS (
       SELECT
         o.id as orphan_id,
         c.id as target_id,
         ts_rank(c.search_vector, plainto_tsquery('english',
           array_to_string(tsvector_to_array(o.search_vector), ' ')
         )) as rank,
         ROW_NUMBER() OVER (
           PARTITION BY o.id
           ORDER BY ts_rank(c.search_vector, plainto_tsquery('english',
             array_to_string(tsvector_to_array(o.search_vector), ' ')
           )) DESC
         ) as rn
       FROM orphans o
       CROSS JOIN connected c
       WHERE c.id != o.id
         AND ts_rank(c.search_vector, plainto_tsquery('english',
           array_to_string(tsvector_to_array(o.search_vector), ' ')
         )) > $2
     )
     SELECT orphan_id, target_id, rank
     FROM ranked
     WHERE rn <= $3`,
    [brainId, FTS_RANK_THRESHOLD, MAX_LINKS_PER_ORPHAN]
  );

  const pairs: LinkPair[] = rows.map((r) => ({
    fromId: r.orphan_id,
    toId: r.target_id,
    similarity: Math.min(r.rank, 0.99),
    method: "fts" as const,
  }));

  return { linked: new Set(rows.map((r) => r.orphan_id)).size, pairs };
}

/**
 * Bulk-insert link pairs into the links table.
 */
async function bulkInsertLinks(
  brainId: string,
  pairs: LinkPair[]
): Promise<number> {
  if (pairs.length === 0) return 0;

  // Deduplicate
  const seen = new Set<string>();
  const unique = pairs.filter((p) => {
    const key = `${p.fromId}\0${p.toId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let inserted = 0;
  // Insert in chunks of 50 to avoid oversized queries
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const values = chunk
      .map(
        (_p, j) =>
          `($1, $${j * 4 + 2}, $${j * 4 + 3}, 'semantic', $${j * 4 + 4})`
      )
      .join(", ");

    const params: (string | number)[] = [brainId];
    for (const p of chunk) {
      params.push(p.fromId, p.toId, `${p.method}: ${p.similarity.toFixed(3)}`);
    }

    try {
      await query(
        `INSERT INTO links (brain_id, from_page_id, to_page_id, link_type, context)
         VALUES ${values}
         ON CONFLICT DO NOTHING`,
        params
      );
      inserted += chunk.length;
    } catch (err) {
      console.error("[orphan-linker] Bulk insert error:", err);
    }
  }

  return inserted;
}

/**
 * Main entry point: batch-link all orphans using vector similarity
 * with FTS fallback for pages without embeddings.
 */
export async function batchLinkOrphans(
  brainId: string
): Promise<{
  orphansFound: number;
  vectorLinked: number;
  vectorPairs: number;
  ftsLinked: number;
  ftsPairs: number;
  totalInserted: number;
  diagnostics?: Record<string, unknown>;
}> {
  // Count total orphans
  const countRow = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int as cnt FROM pages p
     WHERE p.brain_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM links l
         WHERE l.brain_id = $1
           AND (l.from_page_id = p.id OR l.to_page_id = p.id)
       )`,
    [brainId]
  );
  
  // Diagnostic: count orphans with/without embeddings
  const embedCount = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int as cnt FROM pages p
     WHERE p.brain_id = $1
       AND EXISTS (SELECT 1 FROM content_chunks c WHERE c.page_id = p.id AND c.brain_id = $1 AND c.embedding IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM links l WHERE l.brain_id = $1 AND (l.from_page_id = p.id OR l.to_page_id = p.id))`,
    [brainId]
  );
  const noEmbedCount = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int as cnt FROM pages p
     WHERE p.brain_id = $1
       AND NOT EXISTS (SELECT 1 FROM content_chunks c WHERE c.page_id = p.id AND c.brain_id = $1 AND c.embedding IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM links l WHERE l.brain_id = $1 AND (l.from_page_id = p.id OR l.to_page_id = p.id))`,
    [brainId]
  );
  
  const diagnostics: Record<string, unknown> = {
    total_orphans: countRow?.cnt || 0,
    orphans_with_embeddings: embedCount?.cnt || 0,
    orphans_without_embeddings: noEmbedCount?.cnt || 0,
  };

  const totalOrphans = countRow?.cnt || 0;
  if (totalOrphans === 0) {
    return {
      orphansFound: 0,
      vectorLinked: 0, vectorPairs: 0,
      ftsLinked: 0, ftsPairs: 0,
      totalInserted: 0,
      diagnostics,
    };
  }

  // Phase 1: Vector linking for orphans with embeddings
  const vecResult = await vectorLinkOrphans(brainId);
  const vecInserted = await bulkInsertLinks(brainId, vecResult.pairs);

  // Phase 2: FTS linking for orphans without embeddings
  const ftsResult = await ftsLinkOrphans(brainId);
  const ftsInserted = await bulkInsertLinks(brainId, ftsResult.pairs);

  console.log(
    `[orphan-linker] ${totalOrphans} orphans: ` +
    `${vecResult.linked} vector-linked (${vecInserted} edges), ` +
    `${ftsResult.linked} FTS-linked (${ftsInserted} edges)`
  );
  
  // Attach sample scores to diagnostics  
  diagnostics.sample_scores = vecResult.sampleScores;

  return {
    orphansFound: totalOrphans,
    vectorLinked: vecResult.linked,
    vectorPairs: vecInserted,
    ftsLinked: ftsResult.linked,
    ftsPairs: ftsInserted,
    totalInserted: vecInserted + ftsInserted,
    diagnostics,
  };
}
