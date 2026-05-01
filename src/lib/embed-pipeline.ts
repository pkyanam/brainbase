/**
 * Embedding pipeline for Brainbase — batch embedding generation with retry.
 *
 * Uses OpenAI text-embedding-3-large (1536 dims) via OPENAI_API_KEY.
 * Batches 20 chunks per API call with exponential backoff on rate limits.
 *
 * Public API:
 *   countStaleChunks(brainId)           → number of un-embedded chunks
 *   listStaleChunks(brainId, limit)     → chunk IDs, page slugs, chunk texts
 *   runEmbedPipeline(brainId, mode, slugs?) → orchestrates the full pipeline
 */

import { query, queryMany } from "./supabase/client";

// ── Config ──────────────────────────────────────────────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const EMBED_MODEL = "text-embedding-3-large";
const EMBED_DIMS = 1536;
const BATCH_SIZE = 20;
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1_000;

// ── Types ───────────────────────────────────────────────────────────────────

export interface StaleChunk {
  id: number;
  chunk_text: string;
  page_slug: string;
  page_id: number;
}

export interface EmbedJobChunk {
  id: number;
  chunk_text: string;
}

export type EmbedMode = "stale" | "all";

export interface EmbedPipelineResult {
  chunks_embedded: number;
  errors: number;
  duration_ms: number;
  total_chunks: number;
}

// ── Stale Detection ────────────────────────────────────────────────────────

/** Count chunks with NULL embedding for a brain. */
export async function countStaleChunks(brainId: string): Promise<number> {
  const row = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt
     FROM content_chunks
     WHERE brain_id = $1 AND embedding IS NULL`,
    [brainId]
  );
  return parseInt(String(row.rows[0]?.cnt || "0"), 10);
}

/**
 * List stale chunks (NULL embedding) with their page slug.
 * Optional limit — defaults to 500.
 */
export async function listStaleChunks(
  brainId: string,
  limit = 500
): Promise<StaleChunk[]> {
  const rows = await queryMany<{
    id: number;
    chunk_text: string;
    page_slug: string;
    page_id: number;
  }>(
    `SELECT c.id, c.chunk_text, p.slug AS page_slug, c.page_id
     FROM content_chunks c
     JOIN pages p ON p.id = c.page_id AND p.brain_id = c.brain_id
     WHERE c.brain_id = $1 AND c.embedding IS NULL
     ORDER BY c.id
     LIMIT $2`,
    [brainId, limit]
  );
  return rows;
}

// ── Chunk Fetching by Mode ─────────────────────────────────────────────────

interface FetchChunksOpts {
  brainId: string;
  mode: EmbedMode;
  slugs?: string[];
}

async function fetchChunksToEmbed(
  opts: FetchChunksOpts
): Promise<EmbedJobChunk[]> {
  const { brainId, mode, slugs } = opts;

  if (mode === "stale") {
    if (slugs && slugs.length > 0) {
      // Stale + slug filter
      return queryMany<EmbedJobChunk>(
        `SELECT c.id, c.chunk_text
         FROM content_chunks c
         JOIN pages p ON p.id = c.page_id AND p.brain_id = c.brain_id
         WHERE c.brain_id = $1
           AND c.embedding IS NULL
           AND p.slug = ANY($2::text[])
         ORDER BY c.id`,
        [brainId, slugs]
      );
    }
    // All stale
    return queryMany<EmbedJobChunk>(
      `SELECT id, chunk_text
       FROM content_chunks
       WHERE brain_id = $1 AND embedding IS NULL
       ORDER BY id`,
      [brainId]
    );
  }

  // "all" mode — re-embed everything
  if (slugs && slugs.length > 0) {
    return queryMany<EmbedJobChunk>(
      `SELECT c.id, c.chunk_text
       FROM content_chunks c
       JOIN pages p ON p.id = c.page_id AND p.brain_id = c.brain_id
       WHERE c.brain_id = $1
         AND p.slug = ANY($2::text[])
       ORDER BY c.id`,
      [brainId, slugs]
    );
  }
  return queryMany<EmbedJobChunk>(
    `SELECT id, chunk_text
     FROM content_chunks
     WHERE brain_id = $1
     ORDER BY id`,
    [brainId]
  );
}

// ── OpenAI Embedding (with retry) ──────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate embeddings for a batch of texts.
 * Retries with exponential backoff on 429 rate limits.
 * Returns embeddings array (same order as input) or null on unrecoverable failure.
 */
async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][] | null> {
  if (!OPENAI_API_KEY || texts.length === 0) return null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          input: texts,
          model: EMBED_MODEL,
          dimensions: EMBED_DIMS,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({
          error: { message: res.statusText },
        }));

        // Rate limit — backoff and retry
        if (res.status === 429 && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(
            `[brainbase] Embed rate-limited (attempt ${attempt + 1}/${
              MAX_RETRIES + 1
            }), backing off ${delay}ms...`
          );
          await sleep(delay);
          continue;
        }

        console.error(
          "[brainbase] OpenAI embed error:",
          errBody.error?.message || res.statusText
        );
        return null;
      }

      const data = await res.json();
      return data.data.map((d: { embedding: number[] }) => d.embedding);
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[brainbase] Embed fetch error (attempt ${attempt + 1}/${
            MAX_RETRIES + 1
          }), retrying in ${delay}ms...`,
          err
        );
        await sleep(delay);
        continue;
      }
      console.error("[brainbase] Embed fetch error (exhausted retries):", err);
      return null;
    }
  }

  return null;
}

// ── Pipeline Orchestrator ──────────────────────────────────────────────────

/**
 * Run the full embedding pipeline for a brain.
 *
 * @param brainId - The brain to process
 * @param mode    - "stale" (only NULL-embedding chunks) or "all" (regenerate all)
 * @param slugs   - Optional: only process chunks belonging to these page slugs
 */
export async function runEmbedPipeline(
  brainId: string,
  mode: EmbedMode,
  slugs?: string[]
): Promise<EmbedPipelineResult> {
  const start = Date.now();

  // 1. Fetch all chunks to embed
  const chunks = await fetchChunksToEmbed({ brainId, mode, slugs });
  const totalChunks = chunks.length;

  if (totalChunks === 0) {
    return {
      chunks_embedded: 0,
      errors: 0,
      duration_ms: Date.now() - start,
      total_chunks: 0,
    };
  }

  let chunksEmbedded = 0;
  let errors = 0;

  // 2. Process in batches of BATCH_SIZE
  for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.chunk_text);

    const embeddings = await generateEmbeddingsBatch(texts);

    if (!embeddings) {
      // Unrecoverable failure — mark all remaining as errors and stop
      errors += totalChunks - i;
      console.error(
        `[brainbase] Embed batch failed at offset ${i}/${totalChunks}, aborting`
      );
      break;
    }

    // 3. Update each chunk with its embedding
    for (let j = 0; j < batch.length; j++) {
      const emb = embeddings[j];
      if (!emb) {
        errors++;
        continue;
      }

      try {
        await query(
          `UPDATE content_chunks
           SET embedding = $1::vector,
               embedded_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(emb), batch[j].id]
        );
        chunksEmbedded++;
      } catch (err) {
        console.error(
          `[brainbase] Failed to update embedding for chunk ${batch[j].id}:`,
          err
        );
        errors++;
      }
    }

    console.log(
      `[brainbase] Embedded batch ${Math.floor(i / BATCH_SIZE) + 1}/${
        Math.ceil(totalChunks / BATCH_SIZE)
      } (${chunksEmbedded}/${totalChunks} done)`
    );
  }

  return {
    chunks_embedded: chunksEmbedded,
    errors,
    duration_ms: Date.now() - start,
    total_chunks: totalChunks,
  };
}
