import type { MinionHandler } from '../types';
import { queryMany, query } from '../../supabase/client';

/**
 * Extract handler — extracts backlinks, timeline entries, and graph edges
 * from page markdown content (frontmatter + wikilinks).
 */
export const extractHandler: MinionHandler = async (ctx) => {
  const brainId = ctx.brain_id;

  if (!brainId) {
    throw new Error('brain_id required for extract');
  }

  await ctx.log(`Extracting graph data for brain ${brainId}`);

  const pages = await queryMany<{ slug: string; title: string; content: string }>(
    `SELECT slug, title, content
     FROM pages
     WHERE brain_id = $1
       AND (last_extracted_at IS NULL OR last_extracted_at < updated_at)
     LIMIT 25`,
    [brainId]
  );

  await ctx.updateProgress({ total: pages.length, extracted: 0, message: 'Extracting...' });

  let extracted = 0;
  let linksCreated = 0;
  let timelineEntries = 0;

  for (const page of pages) {
    if (ctx.isTimeRunningOut()) break;

    // Parse wikilinks [[page-slug|title]] or [[page-slug]]
    const wikiRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let match;
    const targets = new Set<string>();
    while ((match = wikiRegex.exec(page.content)) !== null) {
      targets.add(match[1].trim());
    }

    for (const targetSlug of targets) {
      await query(
        `INSERT INTO links (source_slug, target_slug, link_type, brain_id, written_by)
         VALUES ($1, $2, 'wikilink', $3, 'extract_handler')
         ON CONFLICT DO NOTHING`,
        [page.slug, targetSlug, brainId]
      );
      linksCreated++;
    }

    // Parse YAML frontmatter for timeline entries
    const frontmatterMatch = page.content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const fm = frontmatterMatch[1];
      const dateMatch = fm.match(/date:\s*(.+)/);
      if (dateMatch) {
        await query(
          `INSERT INTO timeline_entries (slug, date, summary, brain_id, written_by)
           VALUES ($1, $2, $3, $4, 'extract_handler')
           ON CONFLICT DO NOTHING`,
          [page.slug, dateMatch[1].trim(), 'Page created', brainId]
        );
        timelineEntries++;
      }
    }

    await query(
      'UPDATE pages SET last_extracted_at = NOW() WHERE slug = $1 AND brain_id = $2',
      [page.slug, brainId]
    );

    extracted++;
  }

  return {
    brain_id: brainId,
    total_found: pages.length,
    extracted,
    links_created: linksCreated,
    timeline_entries: timelineEntries,
  };
};
