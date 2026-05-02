/**
 * Auto-extraction pipeline for Brainbase pages.
 * Parses page content for:
 *   - Wikilinks [[slug]] or [[slug|title]] → typed link rows
 *   - Date patterns → timeline entries
 * Runs synchronously after putPage.
 */

import { queryOne, queryMany } from "./supabase/client";
import { createSemanticLinks } from "./semantic-links";
import { extractPageLinks, extractEntityRefs } from "./link-inference";

// ─── Date extraction ──────────────────────────────────────────────

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
  date: string;
  summary: string;
  detail?: string;
}

function extractDates(content: string): ExtractedDate[] {
  const dates: ExtractedDate[] = [];
  const seen = new Set<string>();

  for (const pattern of DATE_PATTERNS) {
    let match: RegExpExecArray | null;
    pattern.re.lastIndex = 0;
    while ((match = pattern.re.exec(content)) !== null) {
      const iso = pattern.fmt(match);
      if (seen.has(iso)) continue;
      seen.add(iso);
      const start = Math.max(0, match.index - 80);
      const end = Math.min(content.length, match.index + match[0].length + 80);
      const snippet = content.slice(start, end).replace(/\s+/g, " ").trim();
      dates.push({ date: iso, summary: snippet });
    }
  }

  return dates;
}

// ─── Orphan detection ──────────────────────────────────────────────

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

// ─── Main pipeline ────────────────────────────────────────────────

export async function runAutoExtract(
  brainId: string,
  pageSlug: string,
  pageType: string,
  content: string
): Promise<{ linksCreated: number; timelineCreated: number; unresolved: string[] }> {
  let linksCreated = 0;
  let timelineCreated = 0;
  const unresolved: string[] = [];

  if (!content || content.trim().length === 0) {
    return { linksCreated, timelineCreated, unresolved };
  }

  // 1. Extract typed links using GBrain-style inference
  const candidates = extractPageLinks(pageSlug, pageType, content);
  for (const link of candidates) {
    try {
      // Ensure target page exists (stub if not)
      const targetExists = await queryOne<{ id: number }>(
        `SELECT id FROM pages WHERE brain_id = $1 AND slug = $2`,
        [brainId, link.targetSlug]
      );
      if (!targetExists) {
        const title = link.targetSlug.split("/").pop()?.replace(/-/g, " ") || link.targetSlug;
        await queryOne(
          `INSERT INTO pages (brain_id, slug, title, type, compiled_truth, frontmatter, search_vector, written_by)
           VALUES ($1, $2, $3, 'unknown', '', '{}'::jsonb, to_tsvector('english', ''), 'system')
           ON CONFLICT (brain_id, slug) DO NOTHING`,
          [brainId, link.targetSlug, title]
        );
      }

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
        [brainId, pageSlug, link.targetSlug, link.linkType]
      );
      if (linkResult) linksCreated++;
    } catch (err) {
      console.error(`[brainbase] Auto-link error ${pageSlug} → ${link.targetSlug}:`, err);
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
           $3, $4, COALESCE($5, ''),
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

  // 3. Semantic auto-linking
  try {
    await createSemanticLinks(brainId, pageSlug, "Auto-linked by semantic similarity");
  } catch (err) {
    console.error(`[brainbase] Semantic link error for ${pageSlug}:`, err);
  }

  return { linksCreated, timelineCreated, unresolved };
}

/**
 * Batch-extract links from pages that haven't been processed yet.
 * Used by the dream cycle to connect the graph overnight.
 */
export async function extractLinksFromStalePages(
  brainId: string,
  limit = 50
): Promise<{
  pagesScanned: number;
  linksCreated: number;
  timelineEntries: number;
}> {
  // Find pages with zero backlinks (never been processed by extraction)
  const rows = await queryMany<{ slug: string; type: string; compiled_truth: string }>(
    `SELECT p.slug, p.type, COALESCE(p.compiled_truth, '') as compiled_truth
     FROM pages p
     WHERE p.brain_id = $1
       AND p.type != 'tweet'  -- skip tweets, too many
       AND NOT EXISTS (
         SELECT 1 FROM links l
         WHERE l.brain_id = $1
           AND (l.from_page_id = p.id OR l.to_page_id = p.id)
       )
       AND p.compiled_truth IS NOT NULL
       AND p.compiled_truth != ''
     LIMIT $2`,
    [brainId, limit]
  );

  let totalLinks = 0;
  let totalTimeline = 0;

  for (const row of rows) {
    try {
      const result = await runAutoExtract(brainId, row.slug, row.type, row.compiled_truth);
      totalLinks += result.linksCreated;
      totalTimeline += result.timelineCreated;
    } catch (err) {
      console.error(`[brainbase] Extract error for ${row.slug}:`, err);
    }
  }

  console.log(
    `[brainbase] Batch extract: ${rows.length} pages → ${totalLinks} links, ${totalTimeline} timeline entries`
  );

  return {
    pagesScanned: rows.length,
    linksCreated: totalLinks,
    timelineEntries: totalTimeline,
  };
}
