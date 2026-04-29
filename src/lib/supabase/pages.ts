import { queryOne, queryMany } from "./client";

export interface BrainPage {
  slug: string;
  title: string;
  type: string;
  content: string;
  frontmatter: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PageLink {
  slug: string;
  title: string;
  type: string;
  link_type: string;
}

export interface TimelineEntry {
  date: string;
  summary: string;
  detail?: string;
  source?: string;
}

export async function getPage(brainId: string, slug: string): Promise<BrainPage | null> {
  const row = await queryOne<{
    slug: string; title: string; type: string;
    compiled_truth: string; frontmatter: Record<string, unknown>;
    created_at: string; updated_at: string;
  }>(
    `SELECT slug, title, type, compiled_truth, frontmatter, created_at::text, updated_at::text
     FROM pages WHERE brain_id = $1 AND slug = $2`,
    [brainId, slug]
  );

  if (!row) return null;

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

export async function getPageLinks(brainId: string, slug: string): Promise<{
  outgoing: PageLink[]; incoming: PageLink[];
}> {
  const outgoing = await queryMany<{ slug: string; title: string; type: string; link_type: string }>(
    `SELECT tp.slug, tp.title, tp.type, l.link_type
     FROM links l
     JOIN pages fp ON fp.id = l.from_page_id
     JOIN pages tp ON tp.id = l.to_page_id
     WHERE l.brain_id = $1 AND fp.slug = $2
     ORDER BY l.link_type
     LIMIT 50`,
    [brainId, slug]
  );

  const incoming = await queryMany<{ slug: string; title: string; type: string; link_type: string }>(
    `SELECT fp.slug, fp.title, fp.type, l.link_type
     FROM links l
     JOIN pages fp ON fp.id = l.from_page_id
     JOIN pages tp ON tp.id = l.to_page_id
     WHERE l.brain_id = $1 AND tp.slug = $2
     ORDER BY l.link_type
     LIMIT 50`,
    [brainId, slug]
  );

  return {
    outgoing: outgoing.map(r => ({ slug: r.slug, title: r.title, type: r.type, link_type: r.link_type })),
    incoming: incoming.map(r => ({ slug: r.slug, title: r.title, type: r.type, link_type: r.link_type })),
  };
}

export async function getTimeline(brainId: string, slug: string): Promise<TimelineEntry[]> {
  const rows = await queryMany<{
    date: string; summary: string; detail: string; source: string;
  }>(
    `SELECT te.date::text, te.summary, te.detail, te.source
     FROM timeline_entries te
     JOIN pages p ON p.id = te.page_id
     WHERE te.brain_id = $1 AND p.slug = $2
     ORDER BY te.date DESC
     LIMIT 50`,
    [brainId, slug]
  );

  return rows.map(r => ({
    date: r.date,
    summary: r.summary,
    detail: r.detail || undefined,
    source: r.source || undefined,
  }));
}
