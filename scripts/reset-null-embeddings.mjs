/**
 * Reset embedded_at to NULL for chunks where embedding IS NULL.
 * GBrain's embed --stale filters on embedded_at, missing these stuck chunks.
 * Run: node scripts/reset-null-embeddings.mjs
 */
import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const gbrainConfig = JSON.parse(
  readFileSync(resolve(homedir(), ".gbrain", "config.json"), "utf-8")
);
const DB_URL = gbrainConfig.database_url;

const pool = new pg.Pool({
  connectionString: DB_URL,
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

async function main() {
  try {
    const count = await pool.query(
      `SELECT COUNT(*) FROM content_chunks WHERE embedding IS NULL AND embedded_at IS NOT NULL`
    );
    console.log(`Chunks with embedded_at set but embedding NULL: ${count.rows[0].count}`);

    if (parseInt(count.rows[0].count) > 0) {
      await pool.query(
        `UPDATE content_chunks SET embedded_at = NULL WHERE embedding IS NULL AND embedded_at IS NOT NULL`
      );
      console.log("✅ Reset embedded_at to NULL for all stuck chunks.");
    } else {
      console.log("✅ No stuck chunks found.");
    }
  } catch (err) {
    console.error("❌", err.message);
  } finally {
    await pool.end();
  }
}

main();
