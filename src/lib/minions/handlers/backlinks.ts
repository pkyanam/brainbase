import type { MinionHandler } from '../types';
import { queryMany, query } from '../../supabase/client';

/**
 * Backlinks handler — enforces the Iron Law of back-linking.
 */
export const backlinksHandler: MinionHandler = async (ctx) => {
  const brainId = ctx.brain_id;

  if (!brainId) {
    throw new Error('brain_id required for backlinks');
  }

  await ctx.log(`Enforcing backlinks for brain ${brainId}`);

  const missingBacklinks = await queryMany<{
    source_slug: string;
    target_slug: string;
  }>(
    `SELECT DISTINCT l.source_slug, l.target_slug
     FROM links l
     WHERE l.brain_id = $1
       AND l.link_type != 'backlink'
       AND NOT EXISTS (
         SELECT 1 FROM links bl
         WHERE bl.source_slug = l.target_slug
           AND bl.target_slug = l.source_slug
           AND bl.link_type = 'backlink'
           AND bl.brain_id = $1
       )`,
    [brainId]
  );

  await ctx.updateProgress({
    total: missingBacklinks.length,
    created: 0,
    message: 'Creating backlinks...',
  });

  let created = 0;

  for (const { source_slug, target_slug } of missingBacklinks) {
    if (ctx.isTimeRunningOut()) break;

    await query(
      `INSERT INTO links (source_slug, target_slug, link_type, brain_id, written_by)
       VALUES ($1, $2, 'backlink', $3, 'backlinks_handler')
       ON CONFLICT DO NOTHING`,
      [target_slug, source_slug, brainId]
    );
    created++;
  }

  return {
    brain_id: brainId,
    missing_total: missingBacklinks.length,
    backlinks_created: created,
  };
};
