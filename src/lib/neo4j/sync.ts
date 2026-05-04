/**
 * Postgres → Neo4j graph projection sync.
 *
 * Postgres is the system of record. Neo4j holds a thin derived projection:
 *   (:Page {slug, title, type, brain_id, updated_at})
 *     -[:LINKS_TO {type, context, brain_id}]->
 *   (:Page)
 *
 * Algorithm (idempotent, watermark-based):
 *   1. Read sync watermark for the brain from `neo4j_sync_state`.
 *   2. Fetch pages from Postgres where `updated_at > watermark`, ordered ASC, capped.
 *   3. UNWIND-MERGE pages into Neo4j.
 *   4. For each touched page, rebuild its outgoing edges in Neo4j
 *      (DELETE outgoing, then INSERT current outgoing from Postgres).
 *   5. Advance watermark to the max(updated_at) seen in this batch.
 *
 * Why per-page rebuild for edges: Postgres `links` has no reliable updated_at,
 * but pages' updated_at advances when content/extraction changes — the same
 * moment edges typically change. A `forceFull` mode resyncs the entire brain
 * for initial backfill or after schema drift.
 *
 * Failure mode: if Neo4j is unconfigured or unreachable, this returns
 * `{ status: "skipped", reason }` and the dream cycle keeps going.
 */

import { query, queryMany, queryOne } from "../supabase/client";
import { runWrite, isSingleDbMode, ping } from "./driver";

const BATCH_SIZE = 1000;

export interface SyncResult {
  status: "completed" | "skipped" | "failed";
  reason?: string;
  pages_synced: number;
  edges_synced: number;
  watermark_before?: string;
  watermark_after?: string;
  brain_id: string;
}

/** Idempotent table for tracking sync watermarks. Caller must pre-create or
 *  call `ensureSyncSchema()`. */
export async function ensureSyncSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS neo4j_sync_state (
      brain_id UUID PRIMARY KEY,
      last_pages_synced_at TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
      last_full_resync_at TIMESTAMPTZ,
      pages_synced_total BIGINT NOT NULL DEFAULT 0,
      edges_synced_total BIGINT NOT NULL DEFAULT 0,
      last_status TEXT,
      last_error TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_neo4j_sync_state_updated ON neo4j_sync_state(updated_at)`);
}

interface SyncRow {
  last_pages_synced_at: string;
  pages_synced_total: number;
  edges_synced_total: number;
}

async function loadWatermark(brainId: string): Promise<string> {
  const row = await queryOne<SyncRow>(
    `SELECT last_pages_synced_at::text FROM neo4j_sync_state WHERE brain_id = $1`,
    [brainId]
  );
  return row?.last_pages_synced_at ?? "1970-01-01T00:00:00Z";
}

async function persistWatermark(
  brainId: string,
  watermark: string,
  pagesAdded: number,
  edgesAdded: number,
  status: string,
  errorMsg: string | null,
  fullResync: boolean
): Promise<void> {
  await query(
    `INSERT INTO neo4j_sync_state
       (brain_id, last_pages_synced_at, pages_synced_total, edges_synced_total,
        last_full_resync_at, last_status, last_error, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (brain_id) DO UPDATE SET
       last_pages_synced_at = GREATEST(neo4j_sync_state.last_pages_synced_at, EXCLUDED.last_pages_synced_at),
       pages_synced_total = neo4j_sync_state.pages_synced_total + $3,
       edges_synced_total = neo4j_sync_state.edges_synced_total + $4,
       last_full_resync_at = COALESCE(EXCLUDED.last_full_resync_at, neo4j_sync_state.last_full_resync_at),
       last_status = EXCLUDED.last_status,
       last_error = EXCLUDED.last_error,
       updated_at = NOW()`,
    [
      brainId,
      watermark,
      pagesAdded,
      edgesAdded,
      fullResync ? new Date().toISOString() : null,
      status,
      errorMsg,
    ]
  );
}

interface PageRow {
  slug: string;
  title: string;
  type: string | null;
  updated_at: string;
}

interface EdgeRow {
  from_slug: string;
  to_slug: string;
  link_type: string | null;
  context: string | null;
}

async function fetchChangedPages(
  brainId: string,
  since: string,
  limit: number,
  forceFull: boolean
): Promise<PageRow[]> {
  if (forceFull) {
    return queryMany<PageRow>(
      `SELECT slug, title, COALESCE(type,'unknown') AS type, updated_at::text
       FROM pages
       WHERE brain_id = $1
       ORDER BY updated_at ASC
       LIMIT $2`,
      [brainId, limit]
    );
  }
  return queryMany<PageRow>(
    `SELECT slug, title, COALESCE(type,'unknown') AS type, updated_at::text
     FROM pages
     WHERE brain_id = $1 AND updated_at > $2::timestamptz
     ORDER BY updated_at ASC
     LIMIT $3`,
    [brainId, since, limit]
  );
}

async function fetchOutgoingEdges(brainId: string, slugs: string[]): Promise<EdgeRow[]> {
  if (slugs.length === 0) return [];
  return queryMany<EdgeRow>(
    `SELECT fp.slug AS from_slug, tp.slug AS to_slug,
            COALESCE(l.link_type,'related') AS link_type,
            COALESCE(l.context,'') AS context
     FROM links l
     JOIN pages fp ON fp.id = l.from_page_id AND fp.brain_id = l.brain_id
     JOIN pages tp ON tp.id = l.to_page_id   AND tp.brain_id = l.brain_id
     WHERE l.brain_id = $1 AND fp.slug = ANY($2::text[])`,
    [brainId, slugs]
  );
}

async function upsertPagesIntoNeo4j(brainId: string, pages: PageRow[]): Promise<void> {
  if (pages.length === 0) return;
  const single = isSingleDbMode();
  await runWrite(
    brainId,
    `UNWIND $pages AS p
     MERGE (n:Page {slug: p.slug${single ? ", brain_id: $brainId" : ""}})
     ON CREATE SET n.title = p.title, n.type = p.type, n.updated_at = p.updated_at,
                   n.created_at = p.updated_at${single ? ", n.brain_id = $brainId" : ""}
     ON MATCH  SET n.title = p.title, n.type = p.type, n.updated_at = p.updated_at`,
    {
      pages: pages.map((p) => ({
        slug: p.slug,
        title: p.title || p.slug,
        type: p.type || "unknown",
        updated_at: p.updated_at,
      })),
    }
  );
}

async function rebuildOutgoingEdgesInNeo4j(
  brainId: string,
  slugs: string[],
  edges: EdgeRow[]
): Promise<number> {
  if (slugs.length === 0) return 0;
  const single = isSingleDbMode();
  // 1) Drop all outgoing edges from these source pages
  await runWrite(
    brainId,
    `MATCH (from:Page${single ? " {brain_id: $brainId}" : ""})-[r:LINKS_TO]->()
     WHERE from.slug IN $slugs
     DELETE r`,
    { slugs }
  );

  if (edges.length === 0) return 0;

  // 2) Re-create edges. MERGE target page if it doesn't yet exist in the projection
  //    (target may be a page we haven't synced yet or an external slug).
  const result = await runWrite(
    brainId,
    `UNWIND $edges AS e
     MATCH (from:Page${single ? " {brain_id: $brainId, slug: e.from_slug}" : " {slug: e.from_slug}"})
     MERGE (to:Page {slug: e.to_slug${single ? ", brain_id: $brainId" : ""}})
       ON CREATE SET to.title = e.to_slug, to.type = 'unknown'${single ? ", to.brain_id = $brainId" : ""}
     MERGE (from)-[r:LINKS_TO {type: e.link_type}]->(to)
       ON CREATE SET r.context = e.context${single ? ", r.brain_id = $brainId" : ""}
       ON MATCH  SET r.context = e.context
     RETURN count(r) AS created`,
    { edges }
  );
  return Number(result[0]?.created ?? 0);
}

export interface SyncOptions {
  /** Resync the entire brain from scratch — ignores watermark. */
  forceFull?: boolean;
  /** Cap on pages processed in one call (default 1000). */
  limit?: number;
}

export async function syncBrainGraph(
  brainId: string,
  opts: SyncOptions = {}
): Promise<SyncResult> {
  // Skip cleanly when Neo4j isn't configured — no env, no exception.
  if (!process.env.NEO4J_URI) {
    return {
      status: "skipped",
      reason: "NEO4J_URI not set",
      pages_synced: 0,
      edges_synced: 0,
      brain_id: brainId,
    };
  }

  // Verify the database is reachable before doing any Postgres work.
  try {
    await ping();
  } catch (e: any) {
    return {
      status: "skipped",
      reason: `Neo4j unreachable: ${e?.message ?? String(e)}`,
      pages_synced: 0,
      edges_synced: 0,
      brain_id: brainId,
    };
  }

  await ensureSyncSchema();
  const watermarkBefore = await loadWatermark(brainId);
  const limit = opts.limit ?? BATCH_SIZE;

  try {
    const pages = await fetchChangedPages(brainId, watermarkBefore, limit, !!opts.forceFull);
    if (pages.length === 0) {
      await persistWatermark(brainId, watermarkBefore, 0, 0, "completed", null, !!opts.forceFull);
      return {
        status: "completed",
        pages_synced: 0,
        edges_synced: 0,
        watermark_before: watermarkBefore,
        watermark_after: watermarkBefore,
        brain_id: brainId,
      };
    }

    await upsertPagesIntoNeo4j(brainId, pages);

    const slugs = pages.map((p) => p.slug);
    const edges = await fetchOutgoingEdges(brainId, slugs);
    const edgesCreated = await rebuildOutgoingEdgesInNeo4j(brainId, slugs, edges);

    const watermarkAfter = pages[pages.length - 1].updated_at;
    await persistWatermark(
      brainId,
      watermarkAfter,
      pages.length,
      edgesCreated,
      "completed",
      null,
      !!opts.forceFull
    );

    return {
      status: "completed",
      pages_synced: pages.length,
      edges_synced: edgesCreated,
      watermark_before: watermarkBefore,
      watermark_after: watermarkAfter,
      brain_id: brainId,
    };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    await persistWatermark(brainId, watermarkBefore, 0, 0, "failed", msg, !!opts.forceFull).catch(() => {});
    return {
      status: "failed",
      reason: msg,
      pages_synced: 0,
      edges_synced: 0,
      watermark_before: watermarkBefore,
      brain_id: brainId,
    };
  }
}
