/**
 * Create content_chunks for all tweet pages (type='tweet', no existing chunks).
 * Then `gbrain embed --stale` will pick them up.
 * Run: node scripts/prep-tweet-chunks.mjs
 */
import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const config = JSON.parse(
  readFileSync(resolve(homedir(), ".gbrain", "config.json"), "utf-8")
);

const pool = new pg.Pool({
  connectionString: config.database_url,
  max: 4,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

async function main() {
  try {
    // Find tweet pages without chunks
    const result = await pool.query(`
      SELECT p.id, p.slug, p.compiled_truth as body
      FROM pages p
      WHERE p.type = 'tweet'
        AND NOT EXISTS (
          SELECT 1 FROM content_chunks cc WHERE cc.page_id = p.id
        )
      ORDER BY p.slug
    `);
    
    console.log(`${result.rows.length} tweet pages need chunks`);
    
    if (result.rows.length === 0) {
      console.log("✅ All tweet pages already have chunks");
      return;
    }
    
    // Create chunks in batches
    const BATCH = 100;
    let created = 0;
    
    for (let i = 0; i < result.rows.length; i += BATCH) {
      const batch = result.rows.slice(i, i + BATCH);
      const values = [];
      const params = [];
      let idx = 1;
      
      for (const row of batch) {
        const text = (row.body || "").slice(0, 8000);
        // Insert with embedding=NULL and embedded_at=NULL so embed --stale finds it
        values.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3})`);
        params.push(row.id, 0, text, 'compiled_truth');
        idx += 4;
      }
      
      await pool.query(
        `INSERT INTO content_chunks (page_id, chunk_index, chunk_text, chunk_source)
         VALUES ${values.join(", ")}
         ON CONFLICT (page_id, chunk_index) DO NOTHING`,
        params
      );
      
      created += batch.length;
      process.stdout.write(`\r   ${created}/${result.rows.length}`);
    }
    
    console.log(`\n✅ Created ${created} chunks for tweet pages`);
    console.log("\nNow run: gbrain embed --stale");
    
  } catch (err) {
    console.error("❌", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
