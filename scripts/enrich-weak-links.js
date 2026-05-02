const { Pool } = require('pg');
const fs = require('fs');

const url = fs.readFileSync('/tmp/db_url.txt', 'utf8').trim();
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });

const VECTOR_THRESHOLD = 0.35;
const MAX_NEW_LINKS = 3;
const BATCH_SIZE = 50; // pages to process per batch

async function main() {
  const client = await pool.connect();

  // Find pages with 1-2 links that have embeddings
  const weakPages = await client.query(`
    SELECT p.id, p.brain_id, p.slug
    FROM pages p
    WHERE EXISTS (
      SELECT 1 FROM content_chunks c
      WHERE c.page_id = p.id AND c.brain_id = p.brain_id AND c.embedding IS NOT NULL
    )
    AND (
      SELECT COUNT(*) FROM links l
      WHERE l.brain_id = p.brain_id
        AND (l.from_page_id = p.id OR l.to_page_id = p.id)
    ) BETWEEN 1 AND 2
    ORDER BY p.id
    LIMIT 200
  `);

  console.log(`Found ${weakPages.rows.length} weakly-connected pages with embeddings`);
  if (weakPages.rows.length === 0) {
    client.release();
    await pool.end();
    return;
  }

  let totalPairs = 0;
  let inserted = 0;
  const seen = new Set();

  for (let i = 0; i < weakPages.rows.length; i++) {
    const page = weakPages.rows[i];
    try {
      // Get existing link targets to avoid duplicates
      const existing = await client.query(
        `SELECT to_page_id as id FROM links WHERE brain_id = $1 AND from_page_id = $2
         UNION
         SELECT from_page_id as id FROM links WHERE brain_id = $1 AND to_page_id = $2`,
        [page.brain_id, page.id]
      );
      const existingIds = new Set(existing.rows.map(r => r.id));

      // KNN search for best matches
      const rows = await client.query(`
        WITH page_emb AS (
          SELECT AVG(c.embedding)::vector as emb
          FROM content_chunks c
          WHERE c.page_id = $2 AND c.brain_id = $1 AND c.embedding IS NOT NULL
        )
        SELECT c.page_id as target_id,
          1 - (c.embedding <=> (SELECT emb FROM page_emb)) as similarity
        FROM content_chunks c
        WHERE c.brain_id = $1
          AND c.embedding IS NOT NULL
          AND c.page_id != $2
        ORDER BY c.embedding <=> (SELECT emb FROM page_emb)
        LIMIT 20
      `, [page.brain_id, page.id]);

      const targets = new Set();
      let count = 0;
      for (const row of rows.rows) {
        if (targets.has(row.target_id)) continue;
        if (existingIds.has(row.target_id)) continue;
        targets.add(row.target_id);
        if (row.similarity < VECTOR_THRESHOLD) break;

        const key = `${page.id}\0${row.target_id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        await client.query(
          `INSERT INTO links (brain_id, from_page_id, to_page_id, link_type, context)
           VALUES ($1, $2, $3, 'semantic', $4)
           ON CONFLICT DO NOTHING`,
          [page.brain_id, page.id, row.target_id, `weak-link:${row.similarity.toFixed(3)}`]
        );
        inserted++;
        count++;
        if (count >= MAX_NEW_LINKS) break;
      }
      totalPairs += count;

      if ((i + 1) % 25 === 0) {
        console.log(`Progress: ${i + 1}/${weakPages.rows.length}, ${inserted} links inserted so far`);
      }
    } catch (err) {
      console.error(`Failed for page ${page.slug}:`, err.message);
    }
  }

  console.log(`Done: ${totalPairs} new links created for ${weakPages.rows.length} pages`);
  client.release();
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
