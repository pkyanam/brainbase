import { queryOne, queryMany } from "./client";

/**
 * Add a tag to a page. Idempotent — if the tag already exists it's a no-op.
 * Uses Postgres array operations so tags are always deduplicated and sorted.
 */
export async function addTag(
  brainId: string,
  pageSlug: string,
  tag: string
): Promise<string[]> {
  // Normalize tag: lowercase, trim whitespace
  const normalized = tag.toLowerCase().trim();
  if (!normalized) throw new Error("Tag cannot be empty");

  const row = await queryOne<{ tags: string[] | null }>(
    `UPDATE pages
     SET tags = (
       SELECT array_agg(DISTINCT t ORDER BY t)
       FROM unnest(
         CASE
           WHEN tags IS NULL THEN ARRAY[$3]
           ELSE array_append(tags, $3)
         END
       ) AS t
     )
     WHERE brain_id = $1 AND slug = $2
     RETURNING tags`,
    [brainId, pageSlug, normalized]
  );

  if (!row) throw new Error(`Page not found: ${pageSlug}`);
  return row.tags || [];
}

/**
 * Remove a tag from a page. If the tag doesn't exist, silently succeeds.
 */
export async function removeTag(
  brainId: string,
  pageSlug: string,
  tag: string
): Promise<string[]> {
  const normalized = tag.toLowerCase().trim();
  if (!normalized) throw new Error("Tag cannot be empty");

  const row = await queryOne<{ tags: string[] | null }>(
    `UPDATE pages
     SET tags = (
       SELECT CASE WHEN COUNT(*) = 0 THEN NULL ELSE array_agg(t ORDER BY t) END
       FROM unnest(tags) AS t
       WHERE t != $3
     )
     WHERE brain_id = $1 AND slug = $2
     RETURNING tags`,
    [brainId, pageSlug, normalized]
  );

  if (!row) throw new Error(`Page not found: ${pageSlug}`);
  return row.tags || [];
}

/**
 * Get all tags for a page.
 */
export async function getTags(
  brainId: string,
  pageSlug: string
): Promise<string[]> {
  const row = await queryOne<{ tags: string[] | null }>(
    `SELECT tags FROM pages WHERE brain_id = $1 AND slug = $2`,
    [brainId, pageSlug]
  );

  if (!row) throw new Error(`Page not found: ${pageSlug}`);
  return row.tags || [];
}

/**
 * Set tags for a page (replaces all existing tags).
 */
export async function setTags(
  brainId: string,
  pageSlug: string,
  tags: string[]
): Promise<string[]> {
  const normalized = [
    ...new Set(tags.map(t => t.toLowerCase().trim()).filter(Boolean)),
  ].sort();

  const row = await queryOne<{ tags: string[] | null }>(
    `UPDATE pages
     SET tags = $3
     WHERE brain_id = $1 AND slug = $2
     RETURNING tags`,
    [brainId, pageSlug, normalized.length > 0 ? normalized : null]
  );

  if (!row) throw new Error(`Page not found: ${pageSlug}`);
  return row.tags || [];
}

export interface TagCount {
  tag: string;
  count: number;
}

/**
 * List all unique tags across the brain with usage counts.
 */
export async function listTags(brainId: string): Promise<TagCount[]> {
  const rows = await queryMany<{ tag: string; count: string }>(
    `SELECT t AS tag, COUNT(*)::int AS count
     FROM pages, unnest(tags) AS t
     WHERE brain_id = $1 AND tags IS NOT NULL
     GROUP BY t
     ORDER BY count DESC, t`,
    [brainId]
  );

  return rows.map(r => ({
    tag: r.tag,
    count: parseInt(r.count),
  }));
}

/**
 * Find pages by tag.
 */
export async function findPagesByTag(
  brainId: string,
  tag: string,
  limit = 50
): Promise<{ slug: string; title: string; type: string }[]> {
  const normalized = tag.toLowerCase().trim();

  return queryMany<{ slug: string; title: string; type: string }>(
    `SELECT slug, title, type
     FROM pages
     WHERE brain_id = $1 AND $2 = ANY(tags)
     ORDER BY updated_at DESC
     LIMIT $3`,
    [brainId, normalized, limit]
  );
}
