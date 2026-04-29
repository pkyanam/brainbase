/**
 * Embedding generation for Brainbase pages.
 * Uses OpenAI text-embedding-3-small (1536 dims, $0.02/1M tokens).
 * Falls back gracefully if no API key is configured.
 */

import { query } from "./supabase/client";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMS = 1536;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

interface Chunk {
  index: number;
  content: string;
}

/**
 * Split text into overlapping chunks by paragraphs.
 */
export function chunkText(text: string): Chunk[] {
  if (!text || text.trim().length === 0) return [];

  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0);
  const chunks: Chunk[] = [];
  let current = "";
  let index = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (current.length + trimmed.length + 2 > CHUNK_SIZE && current.length > 0) {
      chunks.push({ index, content: current.trim() });
      index++;
      // Carry over overlap
      const words = current.split(/\s+/);
      current = words.slice(-Math.floor(CHUNK_OVERLAP / 5)).join(" ") + "\n\n" + trimmed;
    } else {
      current = current ? current + "\n\n" + trimmed : trimmed;
    }
  }

  if (current.trim().length > 0) {
    chunks.push({ index, content: current.trim() });
  }

  return chunks;
}

/**
 * Generate embeddings via OpenAI API.
 * Returns null array if no API key or on error.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][] | null> {
  if (!OPENAI_API_KEY || texts.length === 0) return null;

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
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      console.error("[brainbase] OpenAI embed error:", err.error?.message || res.statusText);
      return null;
    }

    const data = await res.json();
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  } catch (err) {
    console.error("[brainbase] Embedding fetch error:", err);
    return null;
  }
}

/**
 * Delete existing chunks for a page, then insert new ones with embeddings.
 */
export async function indexPageEmbeddings(
  brainId: string,
  pageSlug: string,
  content: string
): Promise<void> {
  // Find page_id
  const pageRow = await query<{ id: number }>(
    `SELECT id FROM pages WHERE brain_id = $1 AND slug = $2`,
    [brainId, pageSlug]
  );
  if (!pageRow.rows[0]) return;
  const pageId = pageRow.rows[0].id;

  // Delete old chunks
  await query(
    `DELETE FROM content_chunks WHERE brain_id = $1 AND page_id = $2`,
    [brainId, pageId]
  );

  const chunks = chunkText(content);
  if (chunks.length === 0) return;

  const embeddings = await generateEmbeddings(chunks.map(c => c.content));

  // Insert chunks (with or without embeddings)
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings?.[i] || null;

    if (embedding) {
      await query(
        `INSERT INTO content_chunks (brain_id, page_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [brainId, pageId, chunk.index, chunk.content, JSON.stringify(embedding)]
      );
    } else {
      await query(
        `INSERT INTO content_chunks (brain_id, page_id, chunk_index, content)
         VALUES ($1, $2, $3, $4)`,
        [brainId, pageId, chunk.index, chunk.content]
      );
    }
  }

  console.log(`[brainbase] Indexed ${chunks.length} chunks for ${pageSlug}`);
}
