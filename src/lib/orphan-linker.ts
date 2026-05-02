/**
 * Batch orphan linker v3 — end-to-end fix.
 *
 * Problems with v2:
 *   1. LIMIT 500 — most orphans never processed
 *   2. Targets had to be "connected" — in a mostly-orphan brain, no targets exist
 *   3. FTS required search_vector — many imports don't populate this
 *   4. No fallback for pages with neither embeddings nor search_vector
 *
 * Strategy v3:
 *   1. Vector: ALL pages with embeddings are valid targets (orphan→orphan OK)
 *   2. FTS: ALL pages with search_vector are valid targets
 *   3. Title: match remaining orphans by title/slug keyword overlap
 *   4. Process in batches to avoid query timeouts
 */

import { query, queryOne, queryMany } from "./supabase/client";

const VECTOR_THRESHOLD = 0.40; // lowered — cross-domain orphans need looser matching
const FTS_RANK_THRESHOLD = 0.005; // lowered
const MAX_LINKS_PER_ORPHAN = 3;
const BATCH_SIZE = 1000; // process up to 1000 orphans per run

interface LinkPair {
  fromId: number;
  toId: number;
  similarity: number;
  method: "vector" | "fts" | "title";
}

/* ────────────────────────────────────────────────────────────────────────── */

async function getOrphanBuckets(brainId: string) {
  const total = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int as cnt FROM pages p
     WHERE p.brain_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM links l
         WHERE l.brain_id = $1
           AND (l.from_page_id = p.id OR l.to_page_id = p.id)
       )`,
    [brainId]
  );

  const withEmbeds = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int as cnt FROM pages p
     WHERE p.brain_id = $1
       AND EXISTS (
         SELECT 1 FROM content_chunks c
         WHERE c.page_id = p.id AND c.brain_id = $1 AND c.embedding IS NOT NULL
       )
       AND NOT EXISTS (
         SELECT 1 FROM links l
         WHERE l.brain_id = $1
           AND (l.from_page_id = p.id OR l.to_page_id = p.id)
       )`,
    [brainId]
  );

  const withoutEmbeds = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int as cnt FROM pages p
     WHERE p.brain_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM content_chunks c
         WHERE c.page_id = p.id AND c.brain_id = $1 AND c.embedding IS NOT NULL
       )
       AND NOT EXISTS (
         SELECT 1 FROM links l
         WHERE l.brain_id = $1
           AND (l.from_page_id = p.id OR l.to_page_id = p.id)
       )`,
    [brainId]
  );

  const withSearchVec = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*)::int as cnt FROM pages p
     WHERE p.brain_id = $1
       AND p.search_vector IS NOT NULL
       AND p.search_vector != to_tsvector('english', '')
       AND NOT EXISTS (
         SELECT 1 FROM links l
         WHERE l.brain_id = $1
           AND (l.from_page_id = p.id OR l.to_page_id = p.id)
       )`,
    [brainId]
  );

  return {
    total: total?.cnt ?? 0,
    withEmbeds: withEmbeds?.cnt ?? 0,
    withoutEmbeds: withoutEmbeds?.cnt ?? 0,
    withSearchVec: withSearchVec?.cnt ?? 0,
  };
}

/* ── Vector linking ─────────────────────────────────────────────────────── */

async function vectorLinkOrphans(
  brainId: string,
  maxOrphans: number
): Promise<{ linked: number; pairs: LinkPair[]; sampleScores: number[] }> {
  // Targets: ALL pages with embeddings (not just "connected" ones)
  // Orphans: pages with embeddings but no links
  const rows = await queryMany<{
    orphan_id: number;
    target_id: number;
    similarity: number;
  }>(
    `WITH orphan_avgs AS (
       SELECT p.id as orphan_id,
         AVG(c.embedding)::vector as emb
       FROM pages p
       JOIN content_chunks c ON c.page_id = p.id AND c.brain_id = p.brain_id
       WHERE p.brain_id = $1
         AND c.embedding IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM links l
           WHERE l.brain_id = $1
             AND (l.from_page_id = p.id OR l.to_page_id = p.id)
         )
       GROUP BY p.id
       LIMIT $4
     ),
     target_avgs AS (
       SELECT p.id as target_id,
         AVG(c.embedding)::vector as emb
       FROM pages p
       JOIN content_chunks c ON c.page_id = p.id AND c.brain_id = p.brain_id
       WHERE p.brain_id = $1
         AND c.embedding IS NOT NULL
       GROUP BY p.id
     ),
     ranked AS (
       SELECT
         o.orphan_id,
         t.target_id,
         1 - (t.emb <=> o.emb) as similarity,
         ROW_NUMBER() OVER (
           PARTITION BY o.orphan_id
           ORDER BY 1 - (t.emb <=> o.emb) DESC
         ) as rn
       FROM orphan_avgs o
       CROSS JOIN target_avgs t
       WHERE o.orphan_id != t.target_id
         AND 1 - (t.emb <=> o.emb) > $2
     )
     SELECT orphan_id, target_id, similarity
     FROM ranked
     WHERE rn <= $3`,
    [brainId, VECTOR_THRESHOLD, MAX_LINKS_PER_ORPHAN, maxOrphans]
  );

  const pairs: LinkPair[] = rows.map((r) => ({
    fromId: r.orphan_id,
    toId: r.target_id,
    similarity: r.similarity,
    method: "vector" as const,
  }));

  const uniqueOrphans = new Set(rows.map((r) => r.orphan_id)).size;
  const sampleScores = rows.slice(0, 5).map((r) => r.similarity);

  console.log(
    `[orphan-linker] Vector: ${uniqueOrphans}/${maxOrphans} orphans linked, ` +
      `${pairs.length} pairs, scores: [${sampleScores.join(", ")}]`
  );

  return { linked: uniqueOrphans, pairs, sampleScores };
}

/* ── FTS linking ────────────────────────────────────────────────────────── */

async function ftsLinkOrphans(
  brainId: string,
  maxOrphans: number
): Promise<{ linked: number; pairs: LinkPair[] }> {
  // Targets: ALL pages with search_vector (not just "connected" ones)
  // Orphans: pages without embeddings, with search_vector, no links
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
       LIMIT $4
     ),
     targets AS (
       SELECT p.id, p.search_vector
       FROM pages p
       WHERE p.brain_id = $1
         AND p.search_vector IS NOT NULL
         AND p.search_vector != to_tsvector('english', '')
     ),
     ranked AS (
       SELECT
         o.id as orphan_id,
         t.id as target_id,
         ts_rank(t.search_vector, plainto_tsquery('english',
           array_to_string(tsvector_to_array(o.search_vector), ' ')
         )) as rank,
         ROW_NUMBER() OVER (
           PARTITION BY o.id
           ORDER BY ts_rank(t.search_vector, plainto_tsquery('english',
             array_to_string(tsvector_to_array(o.search_vector), ' ')
           )) DESC
         ) as rn
       FROM orphans o
       CROSS JOIN targets t
       WHERE t.id != o.id
         AND ts_rank(t.search_vector, plainto_tsquery('english',
           array_to_string(tsvector_to_array(o.search_vector), ' ')
         )) > $2
     )
     SELECT orphan_id, target_id, rank
     FROM ranked
     WHERE rn <= $3`,
    [brainId, FTS_RANK_THRESHOLD, MAX_LINKS_PER_ORPHAN, maxOrphans]
  );

  const pairs: LinkPair[] = rows.map((r) => ({
    fromId: r.orphan_id,
    toId: r.target_id,
    similarity: Math.min(r.rank, 0.99),
    method: "fts" as const,
  }));

  console.log(
    `[orphan-linker] FTS: ${new Set(rows.map((r) => r.orphan_id)).size} orphans linked, ${pairs.length} pairs`
  );

  return { linked: new Set(rows.map((r) => r.orphan_id)).size, pairs };
}

/* ── Title fallback ─────────────────────────────────────────────────────── */

async function titleLinkOrphans(
  brainId: string,
  maxOrphans: number
): Promise<{ linked: number; pairs: LinkPair[] }> {
  // For orphans with neither embeddings nor search_vector,
  // try matching by overlapping title keywords.
  const rows = await queryMany<{
    orphan_id: number;
    target_id: number;
    overlap: number;
  }>(
    `WITH orphans AS (
       SELECT p.id, p.title, p.slug
       FROM pages p
       WHERE p.brain_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM content_chunks c
           WHERE c.page_id = p.id AND c.brain_id = $1 AND c.embedding IS NOT NULL
         )
         AND (p.search_vector IS NULL OR p.search_vector = to_tsvector('english', ''))
         AND NOT EXISTS (
           SELECT 1 FROM links l
           WHERE l.brain_id = $1
             AND (l.from_page_id = p.id OR l.to_page_id = p.id)
         )
       LIMIT $3
     ),
     targets AS (
       SELECT p.id, p.title, p.slug
       FROM pages p
       WHERE p.brain_id = $1
     ),
     scored AS (
       SELECT
         o.id as orphan_id,
         t.id as target_id,
         (
           (
             SELECT COUNT(*) FROM (
               SELECT UNNEST(string_to_array(lower(regexp_replace(COALESCE(o.title, o.slug), '[^a-z0-9 ]', ' ', 'g')), ' '))
               INTERSECT
               SELECT UNNEST(string_to_array(lower(regexp_replace(COALESCE(t.title, t.slug), '[^a-z0-9 ]', ' ', 'g')), ' '))
             ) sq
           )::float /
           GREATEST(
             cardinality(string_to_array(lower(regexp_replace(COALESCE(o.title, o.slug), '[^a-z0-9 ]', ' ', 'g')), ' ')),
             1
           )
         ) as overlap,
         ROW_NUMBER() OVER (PARTITION BY o.id ORDER BY
           (
             SELECT COUNT(*) FROM (
               SELECT UNNEST(string_to_array(lower(regexp_replace(COALESCE(o.title, o.slug), '[^a-z0-9 ]', ' ', 'g')), ' '))
               INTERSECT
               SELECT UNNEST(string_to_array(lower(regexp_replace(COALESCE(t.title, t.slug), '[^a-z0-9 ]', ' ', 'g')), ' '))
             ) sq
           ) DESC
         ) as rn
       FROM orphans o
       CROSS JOIN targets t
       WHERE o.id != t.id
         AND COALESCE(o.title, o.slug) IS NOT NULL
         AND COALESCE(t.title, t.slug) IS NOT NULL
     )
     SELECT orphan_id, target_id, overlap
     FROM scored
     WHERE rn <= 3 AND overlap > 0.15`,
    [brainId, MAX_LINKS_PER_ORPHAN, maxOrphans]
  );

  const pairs: LinkPair[] = rows.map((r) => ({
    fromId: r.orphan_id,
    toId: r.target_id,
    similarity: r.overlap,
    method: "title" as const,
  }));

  console.log(
    `[orphan-linker] Title: ${new Set(rows.map((r) => r.orphan_id)).size} orphans linked, ${pairs.length} pairs`
  );

  return { linked: new Set(rows.map((r) => r.orphan_id)).size, pairs };
}

/* ── Bulk insert ────────────────────────────────────────────────────────── */

async function bulkInsertLinks(
  brainId: string,
  pairs: LinkPair[]
): Promise<number> {
  if (pairs.length === 0) return 0;

  const seen = new Set<string>();
  const unique = pairs.filter((p) => {
    const key = `${p.fromId}\0${p.toId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let inserted = 0;
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const values = chunk
      .map((_p, j) => `($1, $${j * 3 + 2}, $${j * 3 + 3}, 'semantic', $${j * 3 + 4})`)
      .join(", ");

    const params: (string | number)[] = [brainId];
    for (const p of chunk) {
      params.push(p.fromId, p.toId, `${p.method}:${p.similarity.toFixed(3)}`);
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

/* ── Main entry ─────────────────────────────────────────────────────────── */

export async function batchLinkOrphans(
  brainId: string
): Promise<{
  orphansFound: number;
  vectorLinked: number;
  vectorPairs: number;
  ftsLinked: number;
  ftsPairs: number;
  titleLinked: number;
  titlePairs: number;
  totalInserted: number;
  diagnostics: Record<string, unknown>;
}> {
  const buckets = await getOrphanBuckets(brainId);
  const totalOrphans = buckets.total;

  const diagnostics: Record<string, unknown> = {
    ...buckets,
    batch_size: BATCH_SIZE,
    vector_threshold: VECTOR_THRESHOLD,
    fts_threshold: FTS_RANK_THRESHOLD,
  };

  if (totalOrphans === 0) {
    return {
      orphansFound: 0,
      vectorLinked: 0, vectorPairs: 0,
      ftsLinked: 0, ftsPairs: 0,
      titleLinked: 0, titlePairs: 0,
      totalInserted: 0,
      diagnostics,
    };
  }

  // Phase 1: Vector linking (orphans WITH embeddings → ALL targets with embeddings)
  const vecResult = await vectorLinkOrphans(brainId, BATCH_SIZE);
  const vecInserted = await bulkInsertLinks(brainId, vecResult.pairs);

  // Phase 2: FTS linking (orphans WITHOUT embeddings but WITH search_vector)
  const ftsResult = await ftsLinkOrphans(brainId, BATCH_SIZE);
  const ftsInserted = await bulkInsertLinks(brainId, ftsResult.pairs);

  // Phase 3: Title fallback (orphans with neither embeddings nor search_vector)
  const titleResult = await titleLinkOrphans(brainId, BATCH_SIZE);
  const titleInserted = await bulkInsertLinks(brainId, titleResult.pairs);

  diagnostics.vector_sample_scores = vecResult.sampleScores;

  console.log(
    `[orphan-linker] Total: ${totalOrphans} orphans, ` +
      `${vecResult.linked} vector + ${ftsResult.linked} FTS + ${titleResult.linked} title = ` +
      `${vecInserted + ftsInserted + titleInserted} edges inserted`
  );

  return {
    orphansFound: totalOrphans,
    vectorLinked: vecResult.linked,
    vectorPairs: vecInserted,
    ftsLinked: ftsResult.linked,
    ftsPairs: ftsInserted,
    titleLinked: titleResult.linked,
    titlePairs: titleInserted,
    totalInserted: vecInserted + ftsInserted + titleInserted,
    diagnostics,
  };
}
