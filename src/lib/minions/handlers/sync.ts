import type { MinionHandler } from '../types';
import { queryOne, queryMany } from '../../supabase/client';
import { runAutoExtract } from '../../auto-extract';
import { indexPageEmbeddings } from '../../embeddings';

/**
 * Sync handler — re-extracts + re-embeds all pages in a brain.
 * Used for full brain re-index operations.
 */
export const syncHandler: MinionHandler = async (ctx) => {
  const full = ctx.data?.full === true;
  const brainId = ctx.brain_id;

  if (!brainId) {
    throw new Error('brain_id required for sync');
  }

  await ctx.log(`Starting ${full ? 'full' : 'incremental'} sync for brain ${brainId}`);

  // Get all pages
  const pages = await queryMany<{
    slug: string;
    type: string;
    compiled_truth: string;
  }>(
    `SELECT slug, type, compiled_truth
     FROM pages
     WHERE brain_id = $1
     ${full ? '' : "AND (last_extracted_at IS NULL OR last_extracted_at < updated_at)"}
     ORDER BY updated_at DESC
     LIMIT 100`,
    [brainId]
  );

  await ctx.updateProgress({ step: 0, total: pages.length, message: 'Syncing...' });

  let extracted = 0;
  let embedded = 0;

  for (const page of pages) {
    if (ctx.isTimeRunningOut()) break;

    // Re-extract links + timeline
    try {
      await runAutoExtract(brainId, page.slug, page.type, page.compiled_truth || '');
      extracted++;
    } catch (err) {
      await ctx.log(`Extract failed for ${page.slug}: ${String(err)}`);
    }

    // Re-embed chunks
    try {
      await indexPageEmbeddings(brainId, page.slug, page.compiled_truth || '');
      embedded++;
    } catch (err) {
      await ctx.log(`Embed failed for ${page.slug}: ${String(err)}`);
    }
  }

  return {
    brain_id: brainId,
    full_sync: full,
    pages_total: pages.length,
    pages_extracted: extracted,
    pages_embedded: embedded,
  };
};
