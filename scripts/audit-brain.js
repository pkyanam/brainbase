const { Pool } = require('pg');
const fs = require('fs');

const url = fs.readFileSync('/tmp/db_url.txt', 'utf8').trim();
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });

async function main() {
  const client = await pool.connect();

  // 1. Chunks without embeddings
  const staleChunks = await client.query('SELECT COUNT(*) as cnt FROM content_chunks WHERE embedding IS NULL');
  console.log('1. Stale chunks:', staleChunks.rows[0].cnt);

  // 2. Pages without ANY chunks
  const noChunks = await client.query(`
    SELECT COUNT(*) as cnt FROM pages p
    WHERE NOT EXISTS (SELECT 1 FROM content_chunks c WHERE c.page_id = p.id AND c.brain_id = p.brain_id)
  `);
  console.log('2. Pages with no chunks:', noChunks.rows[0].cnt);

  // 3. Check if pages table has embedding column
  const hasPageEmbedding = await client.query(`
    SELECT COUNT(*) as cnt FROM information_schema.columns
    WHERE table_name = 'pages' AND column_name = 'embedding'
  `);
  console.log('3. pages.embedding column exists:', hasPageEmbedding.rows[0].cnt > 0);

  if (hasPageEmbedding.rows[0].cnt > 0) {
    const pageEmbeds = await client.query('SELECT COUNT(*) as cnt FROM pages WHERE embedding IS NULL');
    console.log('4. Pages with NULL embedding:', pageEmbeds.rows[0].cnt);
  }

  // 5. Link stats
  const linkStats = await client.query(`
    SELECT 
      COUNT(*) as total_links,
      COUNT(DISTINCT from_page_id) as pages_with_outbound,
      COUNT(DISTINCT to_page_id) as pages_with_inbound
    FROM links
  `);
  console.log('5. Links:', JSON.stringify(linkStats.rows[0]));

  // 6. Pages with very few links (1-2)
  const weakLinks = await client.query(`
    SELECT p.id, p.slug, p.title, COUNT(l.id) as link_count
    FROM pages p
    LEFT JOIN links l ON l.from_page_id = p.id OR l.to_page_id = p.id
    GROUP BY p.id, p.slug, p.title
    HAVING COUNT(l.id) BETWEEN 1 AND 2
    ORDER BY COUNT(l.id), p.slug
    LIMIT 10
  `);
  console.log('6. Sample weak-link pages:', JSON.stringify(weakLinks.rows));

  // 7. Pages with NO chunks - what are they?
  const noChunkPages = await client.query(`
    SELECT p.slug, p.type, p.title
    FROM pages p
    WHERE NOT EXISTS (SELECT 1 FROM content_chunks c WHERE c.page_id = p.id AND c.brain_id = p.brain_id)
    LIMIT 10
  `);
  console.log('7. Pages with no chunks:', JSON.stringify(noChunkPages.rows));

  // 8. Total pages
  const totalPages = await client.query('SELECT COUNT(*) as cnt FROM pages');
  console.log('8. Total pages:', totalPages.rows[0].cnt);

  client.release();
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
