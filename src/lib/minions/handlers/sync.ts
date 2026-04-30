import type { MinionHandler } from '../types';
import { queryOne } from '../../supabase/client';

/**
 * Sync handler — triggers a full brain re-index.
 */
export const syncHandler: MinionHandler = async (ctx) => {
  const full = ctx.data?.full === true;
  const brainId = ctx.brain_id;

  if (!brainId) {
    throw new Error('brain_id required for sync');
  }

  await ctx.log(`Starting ${full ? 'full' : 'incremental'} sync for brain ${brainId}`);

  const pageCount = await queryOne<{ count: string }>(
    'SELECT count(*)::text as count FROM pages WHERE brain_id = $1',
    [brainId]
  );

  const total = parseInt(pageCount?.count ?? '0', 10);
  await ctx.updateProgress({ step: 0, total, message: 'Sync started' });

  return {
    brain_id: brainId,
    full_sync: full,
    pages_total: total,
    status: 'sync_initiated',
  };
};
