const { Pool } = require('pg');
const fs = require('fs');

const url = fs.readFileSync('/tmp/db_url.txt', 'utf8').trim();
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });

const OPENAI_API_KEY = fs.readFileSync('/tmp/openai_key.txt', 'utf8').trim();
const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMS = 1536;
const BATCH_SIZE = 20;

function chunkText(text) {
  if (!text || text.trim().length === 0) return [];
  const CHUNK_SIZE = 1000;
  const CHUNK_OVERLAP = 200;
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0);
  const chunks = [];
  let current = "";
  let index = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (current.length + trimmed.length + 2 > CHUNK_SIZE && current.length > 0) {
      chunks.push({ index, content: current.trim() });
      index++;
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

async function generateEmbeddings(texts) {
  if (!OPENAI_API_KEY || texts.length === 0) return null;
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input: texts, model: EMBED_MODEL, dimensions: EMBED_DIMS }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    console.error("OpenAI error:", err.error?.message || res.statusText);
    return null;
  }
  const data = await res.json();
  return data.data.map(d => d.embedding);
}

async function main() {
  const client = await pool.connect();

  // Find pages with no chunks
  const pages = await client.query(`
    SELECT p.id, p.brain_id, p.slug, p.title, p.compiled_truth
    FROM pages p
    WHERE NOT EXISTS (
      SELECT 1 FROM content_chunks c
      WHERE c.page_id = p.id AND c.brain_id = p.brain_id
    )
  `);

  console.log(`Found ${pages.rows.length} pages with no chunks`);
  if (pages.rows.length === 0) {
    client.release();
    await pool.end();
    return;
  }

  let totalChunks = 0;
  let totalEmbedded = 0;

  // Process in batches for embedding API
  for (let i = 0; i < pages.rows.length; i += BATCH_SIZE) {
    const batch = pages.rows.slice(i, i + BATCH_SIZE);
    const allChunks = [];

    for (const page of batch) {
      const content = page.compiled_truth || page.title || page.slug;
      const chunks = chunkText(content);
      for (const c of chunks) {
        allChunks.push({ ...c, page_id: page.id, brain_id: page.brain_id });
      }
    }

    if (allChunks.length === 0) continue;

    const texts = allChunks.map(c => c.content);
    const embeddings = await generateEmbeddings(texts);

    for (let j = 0; j < allChunks.length; j++) {
      const chunk = allChunks[j];
      const embedding = embeddings?.[j];
      try {
        if (embedding) {
          await client.query(
            `INSERT INTO content_chunks (brain_id, page_id, chunk_index, chunk_text, embedding)
             VALUES ($1, $2, $3, $4, $5::vector)`,
            [chunk.brain_id, chunk.page_id, chunk.index, chunk.content, JSON.stringify(embedding)]
          );
          totalEmbedded++;
        } else {
          await client.query(
            `INSERT INTO content_chunks (brain_id, page_id, chunk_index, chunk_text)
             VALUES ($1, $2, $3, $4)`,
            [chunk.brain_id, chunk.page_id, chunk.index, chunk.content]
          );
        }
        totalChunks++;
      } catch (err) {
        console.error(`Failed to insert chunk for page ${chunk.page_id}:`, err.message);
      }
    }

    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pages.rows.length / BATCH_SIZE)}: ${allChunks.length} chunks inserted`);
  }

  console.log(`Done: ${totalChunks} chunks created, ${totalEmbedded} embedded`);
  client.release();
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
