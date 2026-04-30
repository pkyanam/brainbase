import type { MinionHandler } from '../types';
import { queryMany, query } from '../../supabase/client';
import { generateEmbeddings } from '../../embeddings';

/**
 * Embed handler — generates OpenAI embeddings for un-embedded content chunks.
 * Updates the embedding column directly on content_chunks (vector type).
 */
export const embedHandler: MinionHandler = async (ctx) => {
  const brainId = ctx.brain_id;

  if (!brainId) {
    throw new Error('brain_id required for embed');
  }

  await ctx.log(`Embedding chunks for brain ${brainId}`);

  const unembedded = await queryMany<{ id: number; chunk_text: string }>(
    `SELECT id, chunk_text
     FROM content_chunks
     WHERE brain_id = $1 AND embedding IS NULL
     ORDER BY id
     LIMIT 50`,
    [brainId]
  );

  if (unembedded.length === 0) {
    return {
      brain_id: brainId,
      total_found: 0,
      embedded: 0,
      pending: 0,
    };
  }

  await ctx.updateProgress({ total: unembedded.length, embedded: 0, message: 'Generating OpenAI embeddings...' });

  const texts = unembedded.map(c => c.chunk_text);
  const embeddings = await generateEmbeddings(texts);

  if (!embeddings) {
    throw new Error('OpenAI embedding generation failed — check OPENAI_API_KEY and API quota');
  }

  let embedded = 0;
  for (let i = 0; i < unembedded.length; i++) {
    if (ctx.isTimeRunningOut()) break;
    const emb = embeddings[i];
    if (!emb) continue;

    await query(
      `UPDATE content_chunks SET embedding = $1::vector WHERE id = $2`,
      [JSON.stringify(emb), unembedded[i].id]
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
