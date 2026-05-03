/**
 * Public wiki data layer.
 *
 * Reads must enforce two predicates simultaneously:
 *   1. The brain has wiki_enabled = TRUE
 *   2. The page has public = TRUE
 *
 * The auth model: anyone with the URL can read. Owner gates publishing via
 * a per-page boolean. There is intentionally no "share with these emails"
 * mode — that's enterprise territory and not what tier 3 of the vision asks for.
 */

import { queryOne, queryMany } from "./supabase/client";

export interface WikiBrain {
  id: string;
  slug: string;
  name: string;
  wiki_enabled: boolean;
  wiki_title: string | null;
  wiki_tagline: string | null;
}

export interface WikiPage {
  brain_id: string;
  brain_slug: string;
  slug: string;
  title: string;
  type: string;
  content: string;
  frontmatter: Record<string, unknown>;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface WikiPageBrief {
  slug: string;
  title: string;
  type: string;
  updated_at: string;
}

export interface WikiPageLink {
  slug: string;
  title: string;
  type: string;
  link_type: string;
}

export async function loadWikiBrain(brainSlug: string): Promise<WikiBrain | null> {
  return queryOne<WikiBrain>(
    `SELECT id::text, slug, name, wiki_enabled,
            wiki_title, wiki_tagline
     FROM brains
     WHERE slug = $1 AND wiki_enabled = TRUE
     LIMIT 1`,
    [brainSlug]
  );
}

export async function loadWikiPage(brainSlug: string, pageSlug: string): Promise<WikiPage | null> {
  return queryOne<WikiPage>(
    `SELECT b.id::text AS brain_id,
            b.slug AS brain_slug,
            p.slug, p.title, COALESCE(p.type,'unknown') AS type,
            COALESCE(p.compiled_truth,'') AS content,
            COALESCE(p.frontmatter,'{}'::jsonb) AS frontmatter,
            p.tags,
            p.created_at::text, p.updated_at::text
     FROM brains b
     JOIN pages p ON p.brain_id = b.id
     WHERE b.slug = $1
       AND b.wiki_enabled = TRUE
       AND p.slug = $2
       AND p.public = TRUE
     LIMIT 1`,
    [brainSlug, pageSlug]
  );
}

export async function listWikiPages(
  brainSlug: string,
  opts?: { type?: string; limit?: number; offset?: number }
): Promise<WikiPageBrief[]> {
  const conditions: string[] = [`b.slug = $1`, `b.wiki_enabled = TRUE`, `p.public = TRUE`];
  const params: unknown[] = [brainSlug];
  if (opts?.type) {
    params.push(opts.type);
    conditions.push(`p.type = $${params.length}`);
  }
  params.push(opts?.limit ?? 200);
  params.push(opts?.offset ?? 0);

  return queryMany<WikiPageBrief>(
    `SELECT p.slug, p.title, COALESCE(p.type,'unknown') AS type, p.updated_at::text
     FROM brains b
     JOIN pages p ON p.brain_id = b.id
     WHERE ${conditions.join(" AND ")}
     ORDER BY p.updated_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
}

/**
 * Outgoing + incoming links — but only to/from pages that are also public.
 * This stops the wiki from leaking the existence of private linked pages.
 */
export async function loadWikiPageLinks(
  brainId: string,
  pageSlug: string
): Promise<{ outgoing: WikiPageLink[]; incoming: WikiPageLink[] }> {
  const outgoing = await queryMany<WikiPageLink>(
    `SELECT tp.slug, tp.title, COALESCE(tp.type,'unknown') AS type, l.link_type
     FROM links l
     JOIN pages fp ON fp.id = l.from_page_id AND fp.brain_id = l.brain_id
     JOIN pages tp ON tp.id = l.to_page_id   AND tp.brain_id = l.brain_id
     WHERE l.brain_id = $1
       AND fp.slug = $2
       AND tp.public = TRUE
     ORDER BY l.link_type, tp.title
     LIMIT 100`,
    [brainId, pageSlug]
  );

  const incoming = await queryMany<WikiPageLink>(
    `SELECT fp.slug, fp.title, COALESCE(fp.type,'unknown') AS type, l.link_type
     FROM links l
     JOIN pages fp ON fp.id = l.from_page_id AND fp.brain_id = l.brain_id
     JOIN pages tp ON tp.id = l.to_page_id   AND tp.brain_id = l.brain_id
     WHERE l.brain_id = $1
       AND tp.slug = $2
       AND fp.public = TRUE
     ORDER BY l.link_type, fp.title
     LIMIT 100`,
    [brainId, pageSlug]
  );

  return { outgoing, incoming };
}

export interface WikiTimelineEntry {
  date: string;
  summary: string;
  detail: string | null;
  source: string | null;
}

export async function loadWikiTimeline(
  brainId: string,
  pageSlug: string
): Promise<WikiTimelineEntry[]> {
  return queryMany<WikiTimelineEntry>(
    `SELECT t.date::text AS date,
            t.summary,
            t.detail,
            t.source
     FROM timeline_entries t
     JOIN pages p ON p.id = t.page_id AND p.brain_id = t.brain_id
     WHERE t.brain_id = $1 AND p.slug = $2
     ORDER BY t.date DESC
     LIMIT 100`,
    [brainId, pageSlug]
  );
}
