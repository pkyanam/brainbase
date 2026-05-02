"use node";
/**
 * Orphan linker v4 for Convex — runs directly on Supabase via pg.
 *
 * Uses per-orphan KNN (pgvector index) instead of CROSS JOIN.
 * Each orphan query is ~20ms. 100 orphans = ~2s.
 * Safe for Convex 30s action timeout.
 */

import { query, queryOne, queryMany } from "./supabase";

const VECTOR_THRESHOLD = 0.35;
const MAX_LINKS_PER_ORPHAN = 3;
const VECTOR_BATCH = 100;
const FTS_BATCH = 100;
const TITLE_BATCH = 200;

interface LinkPair {
  fromId: number;
  toId: number;
  similarity: number;
  method: "vector" | "fts" | "title";
}

/* ── diagnostics ─────────────────────────────────────────────────────────── */

export async function getOrphanBuckets(brainId: string) {
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
  return {
    total: total?.cnt ?? 0,
    withEmbeds: withEmbeds?.cnt ?? 0,
    withoutEmbeds: withoutEmbeds?.cnt ?? 0,
  };
}

/* ── vector linking (pgvector KNN) ──────────────────────────────────────── */

async function vectorLinkOrphans(
  brainId: string,
  maxOrphans: number
): Promise<{ linked: number; pairs: LinkPair[]; sampleScores: number[] }> {
  const orphans = await queryMany<{ id: number }>(
    `SELECT p.id
     FROM pages p
     WHERE p.brain_id = $1
       AND EXISTS (
         SELECT 1 FROM content_chunks c
         WHERE c.page_id = p.id AND c.brain_id = $1 AND c.embedding IS NOT NULL
       )
       AND NOT EXISTS (
         SELECT 1 FROM links l
         WHERE l.brain_id = $1
           AND (l.from_page_id = p.id OR l.to_page_id = p.id)
       )
     LIMIT $2`,
    [brainId, maxOrphans]
  );
  if (orphans.length === 0) return { linked: 0, pairs: [], sampleScores: [] };

  const pairs: LinkPair[] = [];
  const sampleScores: number[] = [];
  let linkedCount = 0;

  for (const orphan of orphans) {
    try {
      const rows = await queryMany<{
        target_id: number;
        similarity: number;
      }>(
        `WITH orphan_emb AS (
           SELECT AVG(c.embedding)::vector as emb
           FROM content_chunks c
           WHERE c.page_id = $2 AND c.brain_id = $1 AND c.embedding IS NOT NULL
         )
         SELECT c.page_id as target_id,
           1 - (c.embedding <=> (SELECT emb FROM orphan_emb)) as similarity
         FROM content_chunks c
         WHERE c.brain_id = $1
           AND c.embedding IS NOT NULL
           AND c.page_id != $2
         ORDER BY c.embedding <=> (SELECT emb FROM orphan_emb)
         LIMIT 30`,
        [brainId, orphan.id]
      );

      const seenTargets = new Set<number>();
      let count = 0;
      for (const row of rows) {
        if (seenTargets.has(row.target_id)) continue;
        seenTargets.add(row.target_id);
        if (row.similarity < VECTOR_THRESHOLD) break;
        pairs.push({
          fromId: orphan.id,
          toId: row.target_id,
          similarity: row.similarity,
          method: "vector",
        });
        if (sampleScores.length < 5) sampleScores.push(row.similarity);
        count++;
        if (count >= MAX_LINKS_PER_ORPHAN) break;
      }
      if (count > 0) linkedCount++;
    } catch (err) {
      console.error(`[orphan-linker] Vector KNN failed for orphan ${orphan.id}:`, err);
    }
  }

  console.log(
    `[orphan-linker] Vector: ${linkedCount}/${orphans.length} orphans linked, ${pairs.length} pairs`
  );
  return { linked: linkedCount, pairs, sampleScores };
}

/* ── FTS linking ─────────────────────────────────────────────────────────── */

async function ftsLinkOrphans(
  brainId: string,
  maxOrphans: number
): Promise<{ linked: number; pairs: LinkPair[] }> {
  const orphans = await queryMany<{ id: number; search_vector: string }>(
    `SELECT p.id, p.search_vector::text
     FROM pages p
     WHERE p.brain_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM content_chunks c
         WHERE c.page_id = p.id AND c.brain_id = $1 AND c.embedding IS NOT NULL
       )
       AND p.search_vector IS NOT NULL
       AND p.search_vector != to_tsvector('english', '')
       AND NOT EXISTS (
         SELECT 1 FROM links l
         WHERE l.brain_id = $1
           AND (l.from_page_id = p.id OR l.to_page_id = p.id)
       )
     LIMIT $2`,
    [brainId, maxOrphans]
  );
  if (orphans.length === 0) return { linked: 0, pairs: [] };

  const pairs: LinkPair[] = [];
  let linkedCount = 0;

  for (const orphan of orphans) {
    try {
      const rows = await queryMany<{
        target_id: number;
        rank: number;
      }>(
        `SELECT p.id as target_id,
           ts_rank(p.search_vector, plainto_tsquery('english',
             array_to_string(tsvector_to_array($2::tsvector), ' ')
           )) as rank
         FROM pages p
         WHERE p.brain_id = $1
           AND p.search_vector IS NOT NULL
           AND p.id != $3
           AND p.search_vector @@ plainto_tsquery('english',
             array_to_string(tsvector_to_array($2::tsvector), ' ')
           )
         ORDER BY rank DESC
         LIMIT $4`,
        [brainId, orphan.search_vector, orphan.id, MAX_LINKS_PER_ORPHAN]
      );

      let count = 0;
      for (const row of rows) {
        if (row.rank < 0.001) break;
        pairs.push({
          fromId: orphan.id,
          toId: row.target_id,
          similarity: Math.min(row.rank, 0.99),
          method: "fts",
        });
        count++;
      }
      if (count > 0) linkedCount++;
    } catch (err) {
      console.error(`[orphan-linker] FTS failed for orphan ${orphan.id}:`, err);
    }
  }

  console.log(
    `[orphan-linker] FTS: ${linkedCount}/${orphans.length} orphans linked, ${pairs.length} pairs`
  );
  return { linked: linkedCount, pairs };
}

/* ── title fallback ──────────────────────────────────────────────────────── */

async function titleLinkOrphans(
  brainId: string,
  maxOrphans: number
): Promise<{ linked: number; pairs: LinkPair[] }> {
  const orphans = await queryMany<{ id: number; text: string }>(
    `SELECT p.id,
       lower(regexp_replace(COALESCE(p.title, p.slug, ''), '[^a-z0-9 ]', ' ', 'g')) as text
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
       AND COALESCE(p.title, p.slug) IS NOT NULL
     LIMIT $2`,
    [brainId, maxOrphans]
  );
  if (orphans.length === 0) return { linked: 0, pairs: [] };

  const targets = await queryMany<{ id: number; text: string }>(
    `SELECT p.id,
       lower(regexp_replace(COALESCE(p.title, p.slug, ''), '[^a-z0-9 ]', ' ', 'g')) as text
     FROM pages p
     WHERE p.brain_id = $1
       AND COALESCE(p.title, p.slug) IS NOT NULL`,
    [brainId]
  );

  const pairs: LinkPair[] = [];
  let linkedCount = 0;

  for (const orphan of orphans) {
    const orphanWords = new Set(orphan.text.split(/\s+/).filter((w) => w.length > 2));
    if (orphanWords.size === 0) continue;

    const scored: { targetId: number; overlap: number }[] = [];
    for (const target of targets) {
      if (target.id === orphan.id) continue;
      const targetWords = new Set(target.text.split(/\s+/).filter((w) => w.length > 2));
      if (targetWords.size === 0) continue;

      let overlap = 0;
      for (const w of Array.from(orphanWords)) {
        if (targetWords.has(w)) overlap++;
      }
      const denom = Math.min(orphanWords.size, targetWords.size);
      if (denom > 0 && overlap / denom > 0.2) {
        scored.push({ targetId: target.id, overlap: overlap / denom });
      }
    }

    scored.sort((a, b) => b.overlap - a.overlap);
    const top = scored.slice(0, MAX_LINKS_PER_ORPHAN);
    for (const s of top) {
      pairs.push({
        fromId: orphan.id,
        toId: s.targetId,
        similarity: s.overlap,
        method: "title",
      });
    }
    if (top.length > 0) linkedCount++;
  }

  console.log(
    `[orphan-linker] Title: ${linkedCount}/${orphans.length} orphans linked, ${pairs.length} pairs`
  );
  return { linked: linkedCount, pairs };
}

/* ── bulk insert ─────────────────────────────────────────────────────────── */

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

/* ── main entry ──────────────────────────────────────────────────────────── */

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
  const t0 = Date.now();
  const buckets = await getOrphanBuckets(brainId);
  const totalOrphans = buckets.total;

  const diagnostics: Record<string, unknown> = {
    ...buckets,
    vector_batch: VECTOR_BATCH,
    fts_batch: FTS_BATCH,
    title_batch: TITLE_BATCH,
    vector_threshold: VECTOR_THRESHOLD,
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

  const vecResult = await vectorLinkOrphans(brainId, VECTOR_BATCH);
  const vecInserted = await bulkInsertLinks(brainId, vecResult.pairs);

  const ftsResult = await ftsLinkOrphans(brainId, FTS_BATCH);
  const ftsInserted = await bulkInsertLinks(brainId, ftsResult.pairs);

  const titleResult = await titleLinkOrphans(brainId, TITLE_BATCH);
  const titleInserted = await bulkInsertLinks(brainId, titleResult.pairs);

  diagnostics.vector_sample_scores = vecResult.sampleScores;
  diagnostics.duration_ms = Date.now() - t0;

  console.log(
    `[orphan-linker] Total: ${totalOrphans} orphans, ` +
      `${vecResult.linked}v/${ftsResult.linked}f/${titleResult.linked}t linked, ` +
      `${vecInserted + ftsInserted + titleInserted} edges inserted in ${Date.now() - t0}ms`
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
