import { queryOne, queryMany } from "./client";

export interface RawDataEntry {
  id: string;
  brain_id: string;
  page_slug: string;
  source: string;
  data: Record<string, unknown>;
  fetched_at: string;
  created_at: string;
}

/**
 * Store raw API response data for a page. Provenance is critical for
 * enrichment — if compiled truth is ever questioned, the raw data shows
 * exactly what the external API returned.
 */
export async function putRawData(
  brainId: string,
  pageSlug: string,
  source: string,
  data: Record<string, unknown>
): Promise<RawDataEntry> {
  const row = await queryOne<{
    id: string; brain_id: string; page_slug: string;
    source: string; data: Record<string, unknown>;
    fetched_at: string; created_at: string;
  }>(
    `INSERT INTO brain_raw_data (brain_id, page_slug, source, data)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (brain_id, page_slug, source)
     DO UPDATE SET data = EXCLUDED.data, fetched_at = NOW()
     RETURNING id, brain_id, page_slug, source, data, fetched_at::text, created_at::text`,
    [brainId, pageSlug, source, JSON.stringify(data)]
  );

  if (!row) throw new Error("Failed to store raw data");
  return {
    id: row.id,
    brain_id: row.brain_id,
    page_slug: row.page_slug,
    source: row.source,
    data: row.data,
    fetched_at: row.fetched_at,
    created_at: row.created_at,
  };
}

/**
 * Retrieve raw data for a page, optionally filtered by source.
 */
export async function getRawData(
  brainId: string,
  pageSlug: string,
  source?: string
): Promise<RawDataEntry[]> {
  if (source) {
    return queryMany<{
      id: string; brain_id: string; page_slug: string;
      source: string; data: Record<string, unknown>;
      fetched_at: string; created_at: string;
    }>(
      `SELECT id, brain_id, page_slug, source, data, fetched_at::text, created_at::text
       FROM brain_raw_data
       WHERE brain_id = $1 AND page_slug = $2 AND source = $3
       ORDER BY fetched_at DESC`,
      [brainId, pageSlug, source]
    );
  }

  return queryMany<{
    id: string; brain_id: string; page_slug: string;
    source: string; data: Record<string, unknown>;
    fetched_at: string; created_at: string;
  }>(
    `SELECT id, brain_id, page_slug, source, data, fetched_at::text, created_at::text
     FROM brain_raw_data
     WHERE brain_id = $1 AND page_slug = $2
     ORDER BY fetched_at DESC`,
    [brainId, pageSlug]
  );
}

/**
 * Delete raw data entries for a page (cascaded when page is deleted).
 */
export async function deleteRawData(
  brainId: string,
  pageSlug: string,
  source?: string
): Promise<number> {
  const result = source
    ? await queryOne<{ count: string }>(
        `WITH deleted AS (
           DELETE FROM brain_raw_data
           WHERE brain_id = $1 AND page_slug = $2 AND source = $3
           RETURNING id
         ) SELECT COUNT(*) as count FROM deleted`,
        [brainId, pageSlug, source]
      )
    : await queryOne<{ count: string }>(
        `WITH deleted AS (
           DELETE FROM brain_raw_data
           WHERE brain_id = $1 AND page_slug = $2
           RETURNING id
         ) SELECT COUNT(*) as count FROM deleted`,
        [brainId, pageSlug]
      );

  return parseInt(result?.count || "0");
}
