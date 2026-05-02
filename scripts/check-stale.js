const { Pool } = require('pg');
const fs = require('fs');

// Read .env.local manually — handles values with '=' correctly
const envPath = require('path').join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx > 0) {
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
}

const pool = new Pool({
  connectionString: env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

async function main() {
  const client = await pool.connect();
  
  const stale = await client.query('SELECT COUNT(*) as cnt FROM content_chunks WHERE embedding IS NULL');
  console.log('Stale chunks:', stale.rows[0].cnt);

  const byBrain = await client.query('SELECT brain_id, COUNT(*) as cnt FROM content_chunks WHERE embedding IS NULL GROUP BY brain_id ORDER BY cnt DESC');
  console.log('By brain:', byBrain.rows);

  const total = await client.query('SELECT COUNT(*) as cnt FROM content_chunks');
  console.log('Total chunks:', total.rows[0].cnt);

  // Also check pages with no chunks at all
  const noChunks = await client.query(`
    SELECT COUNT(*) as cnt FROM pages p
    WHERE NOT EXISTS (SELECT 1 FROM content_chunks c WHERE c.page_id = p.id AND c.brain_id = p.brain_id)
  `);
  console.log('Pages with no chunks:', noChunks.rows[0].cnt);

  client.release();
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
