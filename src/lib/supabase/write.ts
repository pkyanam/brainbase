import { queryOne, queryMany } from "./client";
import { indexPageEmbeddings } from "../embeddings";
import { runAutoExtract } from "../auto-extract";
import { extractEntityRefs } from "../link-inference";
import { runTriggers } from "../triggers";
import { runActions } from "../actions";

export interface PutPageInput {
  slug: string;
  title: string;
  type?: string;
  content?: string;
  frontmatter?: Record<string, unknown>;
  written_by?: string;
}

export interface PutPageResult {
  slug: string;
  title: string;
  type: string;
  content: string;
  frontmatter: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Reconcile stale links for a page — remove auto-generated links
 * whose target entities are no longer referenced in the current content.
 * Only removes links with written_by = 'system' (not manually created ones).
 */
async function reconcileStaleLinks(brainId: string, slug: string, content: string): Promise<number> {
  if (!content || content.trim().length === 0) return 0;

  try {
    // Extract all entity references from current content
    const refs = extractEntityRefs(content);
    const expectedTargets = new Set(refs.map(r => r.slug));

    // Find auto-generated links whose targets are no longer referenced
    const stale = await queryMany<{ link_id: string; to_slug: string }>(
      `SELECT l.id::text as link_id, p2.slug as to_slug
       FROM links l
       JOIN pages p1 ON l.from_page_id = p1.id AND l.brain_id = p1.brain_id
       JOIN pages p2 ON l.to_page_id = p2.id AND l.brain_id = p2.brain_id
       WHERE l.brain_id = $1
         AND p1.slug = $2
         AND l.written_by = 'system'
         AND l.link_type != 'semantic'`,
      [brainId, slug]
    );

    let removed = 0;
    for (const s of stale) {
      if (!expectedTargets.has(s.to_slug)) {
        await queryOne(
          `DELETE FROM links WHERE brain_id = $1 AND id = $2::bigint`,
          [brainId, s.link_id]
        );
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[brainbase] Stale link reconciliation for ${slug}: removed ${removed} stale links`);
    }
    return removed;
  } catch (err) {
    console.error(`[brainbase] Stale link reconciliation failed for ${slug}:`, err);
    return 0;
  }
}

export async function putPage(brainId: string, input: PutPageInput): Promise<PutPageResult> {
  const row = await queryOne<{
    slug: string;
    title: string;
    type: string;
    compiled_truth: string;
    frontmatter: Record<string, unknown>;
    written_by: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `INSERT INTO pages (brain_id, slug, title, type, compiled_truth, frontmatter, search_vector, written_by)
     VALUES ($1, $2, $3, COALESCE($4, 'unknown'), COALESCE($5, ''), COALESCE($6, '{}'::jsonb), to_tsvector('english', COALESCE($5, '')), $7)
     ON CONFLICT (brain_id, slug) DO UPDATE SET
       title = EXCLUDED.title,
       type = EXCLUDED.type,
       compiled_truth = EXCLUDED.compiled_truth,
       frontmatter = EXCLUDED.frontmatter,
       search_vector = to_tsvector('english', COALESCE(EXCLUDED.compiled_truth, '')),
       written_by = COALESCE(EXCLUDED.written_by, pages.written_by),
       updated_at = NOW()
     RETURNING slug, title, type, compiled_truth, frontmatter, written_by, created_at::text, updated_at::text`,
    [brainId, input.slug, input.title, input.type || null, input.content || null, JSON.stringify(input.frontmatter || {}), input.written_by || null]
  );

  if (!row) throw new Error("Failed to put page");

  // ── Post-write pipeline: embeddings → auto-extract (wikilinks + dates + semantic links) → triggers → actions ──
  const fullContent = input.content || "";
  const pageType = input.type || "unknown";
  if (fullContent.length > 0) {
    // Fire-and-forget: don't block the API response
    (async () => {
      try {
        // 0. Stale link reconciliation — remove links to entities no longer referenced
        await reconcileStaleLinks(brainId, input.slug, fullContent);

        // 1. Generate embeddings
        await indexPageEmbeddings(brainId, input.slug, fullContent);

        // 2. Auto-extract: wikilinks, dates, semantic links
        await runAutoExtract(brainId, input.slug, pageType, fullContent);

        // 3. Evaluate trigger rules
        const fired = await runTriggers(brainId, input.slug, input.title, pageType, fullContent);

        // 4. Execute actions for fired triggers
        if (fired.length > 0) {
          await runActions(fired, {
            brainId,
            pageSlug: input.slug,
            pageTitle: input.title,
            pageType,
            content: fullContent,
            matches: {}, // Filled per-rule in runActions
          });
        }
      } catch (err) {
        console.error("[brainbase] Post-write pipeline failed:", err);
      }
    })();
  }

  return {
    slug: row.slug,
    title: row.title,
    type: row.type || "unknown",
    content: row.compiled_truth || "",
    frontmatter: row.frontmatter || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function deletePage(brainId: string, slug: string): Promise<boolean> {
  const result = await queryOne<{ slug: string }>(
    `DELETE FROM pages WHERE brain_id = $1 AND slug = $2 RETURNING slug`,
    [brainId, slug]
  );
  return !!result;
}

export async function addLink(
  brainId: string,
  fromSlug: string,
  toSlug: string,
  linkType?: string,
  writtenBy?: string
): Promise<boolean> {
  const result = await queryOne<{ id: string }>(
    `INSERT INTO links (brain_id, from_page_id, to_page_id, link_type, written_by)
     VALUES (
       $1,
       (SELECT id FROM pages WHERE brain_id = $1 AND slug = $2),
       (SELECT id FROM pages WHERE brain_id = $1 AND slug = $3),
       COALESCE($4, 'related'),
       $5
     )
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [brainId, fromSlug, toSlug, linkType || null, writtenBy || null]
  );
  return !!result;
}

export async function removeLink(
  brainId: string,
  fromSlug: string,
  toSlug: string
): Promise<boolean> {
  const result = await queryOne<{ id: string }>(
    `DELETE FROM links
     WHERE brain_id = $1
       AND from_page_id = (SELECT id FROM pages WHERE brain_id = $1 AND slug = $2)
       AND to_page_id = (SELECT id FROM pages WHERE brain_id = $1 AND slug = $3)
     RETURNING id`,
    [brainId, fromSlug, toSlug]
  );
  return !!result;
}

export interface TimelineEntryInput {
  slug: string;
  date: string;
  summary: string;
  detail?: string;
  source?: string;
  written_by?: string;
}

export async function addTimelineEntry(
  brainId: string,
  input: TimelineEntryInput
): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO timeline_entries (brain_id, page_id, date, summary, detail, source, written_by)
     VALUES (
       $1,
       (SELECT id FROM pages WHERE brain_id = $1 AND slug = $2),
       $3, $4, $5, $6, $7
     )
     RETURNING id`,
    [brainId, input.slug, input.date, input.summary, input.detail || null, input.source || null, input.written_by || null]
  );

  if (!row) throw new Error("Failed to add timeline entry");
  return { id: row.id };
}

export interface PageListItem {
  slug: string;
  title: string;
  type: string;
  updated_at: string;
}

export async function listPages(brainId: string, options?: {
  type?: string;
  limit?: number;
  offset?: number;
  writtenBy?: string;
}): Promise<PageListItem[]> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const rows = await queryMany<{
    slug: string;
    title: string;
    type: string;
    updated_at: string;
  }>(
    `SELECT slug, title, type, updated_at::text
     FROM pages
     WHERE brain_id = $1
       AND ($2::text IS NULL OR type = $2)
       AND ($3::text IS NULL OR written_by = $3)
     ORDER BY updated_at DESC
     LIMIT $4 OFFSET $5`,
    [brainId, options?.type || null, options?.writtenBy || null, limit, offset]
  );

  return rows;
}

export interface TraversalResult {
  slug: string;
  title: string;
  type: string;
  depth: number;
  link_type?: string;
}

export async function traverseGraph(
  brainId: string,
  startSlug: string,
  depth = 2,
  direction: "out" | "in" | "both" = "out"
): Promise<TraversalResult[]> {
  if (direction === "out") {
    const rows = await queryMany<{
      slug: string;
      title: string;
      type: string;
      depth: number;
      link_type: string;
    }>(
      `WITH RECURSIVE traversal AS (
        SELECT p.id, p.slug, p.title, p.type, 0 AS depth, ARRAY[p.id] AS path
        FROM pages p WHERE p.brain_id = $1 AND p.slug = $2

        UNION ALL

        SELECT p.id, p.slug, p.title, p.type, t.depth + 1, t.path || p.id
        FROM traversal t
        JOIN links l ON l.brain_id = $1 AND l.from_page_id = t.id
        JOIN pages p ON p.brain_id = $1 AND p.id = l.to_page_id
        WHERE t.depth < $3 AND NOT p.id = ANY(t.path)
      )
      SELECT slug, title, type, depth, NULL::text as link_type
      FROM traversal
      ORDER BY depth, title`,
      [brainId, startSlug, depth]
    );
    return rows.map(r => ({
      slug: r.slug,
      title: r.title,
      type: r.type,
      depth: r.depth,
      link_type: r.link_type || undefined,
    }));
  }

  if (direction === "in") {
    const rows = await queryMany<{
      slug: string;
      title: string;
      type: string;
      depth: number;
      link_type: string;
    }>(
      `WITH RECURSIVE traversal AS (
        SELECT p.id, p.slug, p.title, p.type, 0 AS depth, ARRAY[p.id] AS path
        FROM pages p WHERE p.brain_id = $1 AND p.slug = $2

        UNION ALL

        SELECT p.id, p.slug, p.title, p.type, t.depth + 1, t.path || p.id
        FROM traversal t
        JOIN links l ON l.brain_id = $1 AND l.to_page_id = t.id
        JOIN pages p ON p.brain_id = $1 AND p.id = l.from_page_id
        WHERE t.depth < $3 AND NOT p.id = ANY(t.path)
      )
      SELECT slug, title, type, depth, NULL::text as link_type
      FROM traversal
      ORDER BY depth, title`,
      [brainId, startSlug, depth]
    );
    return rows.map(r => ({
      slug: r.slug,
      title: r.title,
      type: r.type,
      depth: r.depth,
      link_type: r.link_type || undefined,
    }));
  }

  const rows = await queryMany<{
    slug: string;
    title: string;
    type: string;
    depth: number;
    link_type: string;
  }>(
    `WITH RECURSIVE traversal AS (
      SELECT p.id, p.slug, p.title, p.type, 0 AS depth, ARRAY[p.id] AS path
      FROM pages p WHERE p.brain_id = $1 AND p.slug = $2

      UNION ALL

      SELECT p.id, p.slug, p.title, p.type, t.depth + 1, t.path || p.id
      FROM traversal t
      JOIN links l ON l.brain_id = $1 AND (l.from_page_id = t.id OR l.to_page_id = t.id)
      JOIN pages p ON p.brain_id = $1 AND p.id = CASE WHEN l.from_page_id = t.id THEN l.to_page_id ELSE l.from_page_id END
      WHERE t.depth < $3 AND NOT p.id = ANY(t.path)
    )
    SELECT slug, title, type, depth, NULL::text as link_type
    FROM traversal
    ORDER BY depth, title`,
    [brainId, startSlug, depth]
  );
  return rows.map(r => ({
    slug: r.slug,
    title: r.title,
    type: r.type,
    depth: r.depth,
    link_type: r.link_type || undefined,
  }));
}

export interface BrainStats {
  page_count: number;
  chunk_count: number;
  link_count: number;
  embed_coverage: number;
  brain_score: number;
  pages_by_type: Record<string, number>;
  most_connected: { slug: string; title: string; link_count: number }[];
}

export async function getStats(brainId: string): Promise<BrainStats> {
  const typeRows = await queryMany<{ type: string; count: string }>(
    `SELECT type, COUNT(*) as count FROM pages WHERE brain_id = $1 GROUP BY type ORDER BY count DESC`,
    [brainId]
  );
  const pages_by_type: Record<string, number> = {};
  let pageCount = 0;
  for (const r of typeRows) {
    pages_by_type[r.type] = parseInt(r.count);
    pageCount += parseInt(r.count);
  }

  const chunkRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM content_chunks WHERE brain_id = $1`,
    [brainId]
  );
  const chunkCount = parseInt(chunkRow?.count || "0");

  const linkRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM links WHERE brain_id = $1`,
    [brainId]
  );
  const linkCount = parseInt(linkRow?.count || "0");

  const embedRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM content_chunks WHERE brain_id = $1 AND embedding IS NOT NULL`,
    [brainId]
  );
  const embedCoverage = chunkCount > 0
    ? Math.round((parseInt(embedRow?.count || "0") / chunkCount) * 100)
    : 0;

  const topRows = await queryMany<{ slug: string; title: string; link_count: string }>(
    `SELECT p.slug, p.title, COUNT(l.id) as link_count
     FROM pages p
     LEFT JOIN links l ON l.brain_id = $1 AND (l.from_page_id = p.id OR l.to_page_id = p.id)
     WHERE p.brain_id = $1
     GROUP BY p.id, p.slug, p.title
     ORDER BY link_count DESC
     LIMIT 5`,
    [brainId]
  );
  const mostConnected = topRows.map(r => ({
    slug: r.slug,
    title: r.title,
    link_count: parseInt(r.link_count),
  }));

  const linkDensity = pageCount > 0 ? linkCount / pageCount : 0;
  const brainScore = Math.min(100, Math.round(
    embedCoverage * 0.35 +
    Math.min(linkDensity * 100, 40) * 0.4 +
    (pageCount > 100 ? 25 : (pageCount / 100) * 25)
  ));

  return {
    page_count: pageCount,
    chunk_count: chunkCount,
    link_count: linkCount,
    embed_coverage: embedCoverage,
    brain_score: brainScore,
    pages_by_type,
    most_connected: mostConnected,
  };
}
