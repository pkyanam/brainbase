import type { MinionHandler } from '../types';
import { queryMany, query } from '../../supabase/client';

/**
 * Embed handler — generates embeddings for un-embedded content chunks.
 */
export const embedHandler: MinionHandler = async (ctx) => {
  const brainId = ctx.brain_id;

  if (!brainId) {
    throw new Error('brain_id required for embed');
  }

  await ctx.log(`Embedding chunks for brain ${brainId}`);

  const unembedded = await queryMany<{ chunk_id: string; chunk_text: string }>(
    `SELECT cc.id::text as chunk_id, cc.chunk_text
     FROM content_chunks cc
     LEFT JOIN embeddings e ON e.chunk_id = cc.id::text
     WHERE cc.brain_id = $1 AND e.id IS NULL
     LIMIT 50`,
    [brainId]
  );

  await ctx.updateProgress({ total: unembedded.length, embedded: 0, message: 'Embedding...' });

  let embedded = 0;
  for (const chunk of unembedded) {
    if (ctx.isTimeRunningOut()) break;

    // Phase 2 skeleton: real embedding via OpenAI
    await query(
      `INSERT INTO embeddings (chunk_id, embedding, brain_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (chunk_id) DO NOTHING`,
      [chunk.chunk_id, '[pending]', brainId]
    );
    embedded++;
  }

  return {
    brain_id: brainId,
    total_found: unembedded.length,
    embedded,
    pending: unembedded.length - embedded,
  };
};
