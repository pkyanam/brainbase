import { query, queryOne, queryMany } from "./supabase/client";

export interface PageVersion {
  id: string;
  page_slug: string;
  title: string;
  type: string;
  content: string;
  frontmatter: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export async function snapshotPageVersion(
  brainId: string,
  slug: string,
  createdBy?: string
): Promise<void> {
  const page = await queryOne<{
    title: string;
    type: string;
    compiled_truth: string;
    frontmatter: Record<string, unknown>;
  }>(
    `SELECT title, type, compiled_truth, frontmatter FROM pages WHERE brain_id = $1 AND slug = $2`,
    [brainId, slug]
  );
  if (!page) return;

  await query(
    `INSERT INTO page_versions (brain_id, page_slug, title, type, content, frontmatter, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [brainId, slug, page.title, page.type, page.compiled_truth, JSON.stringify(page.frontmatter || {}), createdBy || null]
  );
}

export async function listPageVersions(
  brainId: string,
  slug: string,
  limit = 20
): Promise<PageVersion[]> {
  const rows = await queryMany<{
    id: string;
    page_slug: string;
    title: string;
    type: string;
    content: string;
    frontmatter: Record<string, unknown>;
    created_by: string | null;
    created_at: string;
  }>(
    `SELECT id, page_slug, title, type, content, frontmatter, created_by, created_at::text
     FROM page_versions
     WHERE brain_id = $1 AND page_slug = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [brainId, slug, limit]
  );
  return rows;
}

export async function revertPageToVersion(
  brainId: string,
  versionId: string,
  userId?: string
): Promise<{ slug: string; title: string } | null> {
  const version = await queryOne<{
    page_slug: string;
    title: string;
    type: string;
    content: string;
    frontmatter: Record<string, unknown>;
  }>(
    `SELECT page_slug, title, type, content, frontmatter
     FROM page_versions
     WHERE id = $1 AND brain_id = $2`,
    [versionId, brainId]
  );
  if (!version) return null;

  // Snapshot current before reverting
  await snapshotPageVersion(brainId, version.page_slug, userId);

  // Restore
  await query(
    `UPDATE pages
     SET title = $1, type = $2, compiled_truth = $3, frontmatter = $4, updated_at = NOW()
     WHERE brain_id = $5 AND slug = $6`,
    [version.title, version.type, version.content, JSON.stringify(version.frontmatter || {}), brainId, version.page_slug]
  );

  return { slug: version.page_slug, title: version.title };
}
