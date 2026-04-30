/**
 * Auto-extraction pipeline for Brainbase pages.
 * Parses page content for:
 *   - Wikilinks [[slug]] or [[slug|title]] → link rows
 *   - Date patterns → timeline entries
 * Runs synchronously after putPage.
 */

import { queryOne, queryMany } from "./supabase/client";
import { createSemanticLinks } from "./semantic-links";

// ... (rest of the file)

const WIKILINK_RE = /\[\[([^|\]]+)(?:\|([^|\]]+))?\]\]/g;

interface ExtractedLink {
  toSlug: string;
  linkType: string;
}

export function extractWikilinks(content: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    const rawSlug = match[1].trim();
    // Normalize: allow spaces → dashes, lowercase
    const toSlug = rawSlug.toLowerCase().replace(/\s+/g, "-");
    if (seen.has(toSlug)) continue;
    seen.add(toSlug);

    // Infer link type from context
    const contextStart = Math.max(0, match.index - 100);
    const context = content.slice(contextStart, match.index).toLowerCase();
    let linkType = "related";
    if (context.includes("work") || context.includes("at ") || context.includes("job")) linkType = "works_at";
    else if (context.includes("friend") || context.includes("met ") || context.includes("know")) linkType = "friend";
    else if (context.includes("family") || context.includes("brother") || context.includes("sister") || context.includes("dad") || context.includes("mom")) linkType = "family";
    else if (context.includes("invest") || context.includes("funded") || context.includes("backed")) linkType = "invested_in";
    else if (context.includes("found") || context.includes("started") || context.includes("created")) linkType = "founded";
    else if (context.includes("build") || context.includes("made") || context.includes("project")) linkType = "built";

    links.push({ toSlug, linkType });
  }

  return links;
}

// ─── Date extraction ─────────────────────────────────────────

const DATE_PATTERNS = [
  // ISO: 2024-01-15 or 2024/01/15
  { re: /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/g, fmt: (m: RegExpExecArray) => `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` },
  // Month DD, YYYY: January 15, 2024
  { re: /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/gi, fmt: (m: RegExpExecArray) => {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const mon = months.indexOf(m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()) + 1;
    return `${m[3]}-${String(mon).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }},
  // YYYY-MM (loose)
  { re: /(\d{4})[-\/](\d{1,2})(?!\d)/g, fmt: (m: RegExpExecArray) => `${m[1]}-${m[2].padStart(2, "0")}-01` },
];

interface ExtractedDate {
  date: string; // ISO YYYY-MM-DD
  summary: string;
  detail?: string;
}

export function extractDates(content: string): ExtractedDate[] {
  const dates: ExtractedDate[] = [];
  const seen = new Set<string>();

  for (const pattern of DATE_PATTERNS) {
    let match: RegExpExecArray | null;
    // Reset regex
    pattern.re.lastIndex = 0;
    while ((match = pattern.re.exec(content)) !== null) {
      const iso = pattern.fmt(match);
      if (seen.has(iso)) continue;
      seen.add(iso);

      // Extract surrounding sentence as summary
      const start = Math.max(0, match.index - 80);
      const end = Math.min(content.length, match.index + match[0].length + 80);
      const snippet = content.slice(start, end).replace(/\s+/g, " ").trim();

      dates.push({ date: iso, summary: snippet });
    }
  }

  return dates;
}

// ─── Orphan detection ────────────────────────────────────────

export async function findOrphans(brainId: string): Promise<string[]> {
  const rows = await queryMany<{ slug: string }>(
    `SELECT p.slug
     FROM pages p
     WHERE p.brain_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM links l
         WHERE l.brain_id = $1
           AND (l.from_page_id = p.id OR l.to_page_id = p.id)
       )`,
    [brainId]
  );
  return rows.map(r => r.slug);
}

// ─── Main pipeline ───────────────────────────────────────────

export async function runAutoExtract(
  brainId: string,
  pageSlug: string,
  content: string
): Promise<{ linksCreated: number; timelineCreated: number }> {
  let linksCreated = 0;
  let timelineCreated = 0;

  if (!content || content.trim().length === 0) {
    return { linksCreated, timelineCreated };
  }

  // 1. Extract wikilinks and create link rows
  const links = extractWikilinks(content);
  for (const link of links) {
    try {
      // Ensure target page exists (stub if not)
      const targetExists = await queryOne<{ id: number }>(
        `SELECT id FROM pages WHERE brain_id = $1 AND slug = $2`,
        [brainId, link.toSlug]
      );
      if (!targetExists) {
        // Auto-stub the target page
        const title = link.toSlug.split("/").pop()?.replace(/-/g, " ") || link.toSlug;
        await queryOne(
          `INSERT INTO pages (brain_id, slug, title, type, compiled_truth, frontmatter, search_vector, written_by)
           VALUES ($1, $2, $3, 'unknown', '', '{}'::jsonb, to_tsvector('english', ''), 'system')
           ON CONFLICT (brain_id, slug) DO NOTHING`,
          [brainId, link.toSlug, title]
        );
      }

      // Create the link
      const linkResult = await queryOne<{ id: string }>(
        `INSERT INTO links (brain_id, from_page_id, to_page_id, link_type, written_by)
         VALUES (
           $1,
           (SELECT id FROM pages WHERE brain_id = $1 AND slug = $2),
           (SELECT id FROM pages WHERE brain_id = $1 AND slug = $3),
           $4,
           'system'
         )
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [brainId, pageSlug, link.toSlug, link.linkType]
      );
      if (linkResult) linksCreated++;
    } catch (err) {
      console.error(`[brainbase] Auto-link error ${pageSlug} → ${link.toSlug}:`, err);
    }
  }

  // 2. Extract dates and create timeline entries
  const dates = extractDates(content);
  for (const d of dates) {
    try {
      const tlResult = await queryOne<{ id: string }>(
        `INSERT INTO timeline_entries (brain_id, page_id, date, summary, detail, written_by)
         VALUES (
           $1,
           (SELECT id FROM pages WHERE brain_id = $1 AND slug = $2),
           $3, $4, $5,
           'system'
         )
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [brainId, pageSlug, d.date, d.summary, d.detail || null]
      );
      if (tlResult) timelineCreated++;
    } catch (err) {
      console.error(`[brainbase] Auto-timeline error for ${pageSlug}:`, err);
    }
  }

  console.log(`[brainbase] Auto-extract for ${pageSlug}: ${linksCreated} links, ${timelineCreated} timeline entries`);

  // 3. Semantic auto-linking: find related pages via embeddings
  try {
    await createSemanticLinks(brainId, pageSlug, "Auto-linked by semantic similarity");
  } catch (err) {
    console.error(`[brainbase] Semantic link error for ${pageSlug}:`, err);
  }

  return { linksCreated, timelineCreated };
}
