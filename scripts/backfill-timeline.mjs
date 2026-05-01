/**
 * Backfill page.timeline field with tweet archive data for searchability.
 * Concatenates tweets into a compact markdown timeline, then updates the page.
 */
import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const gbrainConfig = JSON.parse(
  readFileSync(resolve(homedir(), ".gbrain", "config.json"), "utf-8")
);
const DB_URL = gbrainConfig.database_url;
const PAGE_SLUG = "preetham-kyanam";

const pool = new pg.Pool({
  connectionString: DB_URL,
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

async function main() {
  try {
    // Get the page
    const pageResult = await pool.query(
      `SELECT id, compiled_truth, timeline FROM pages WHERE slug = $1`,
      [PAGE_SLUG]
    );
    if (pageResult.rows.length === 0) {
      console.error(`Page "${PAGE_SLUG}" not found`);
      process.exit(1);
    }
    const page = pageResult.rows[0];
    
    // Fetch all x-archive timeline entries
    const entries = await pool.query(
      `SELECT date, detail FROM timeline_entries 
       WHERE page_id = $1 AND source = 'x-archive'
       ORDER BY date DESC`,
      [page.id]
    );
    console.log(`Found ${entries.rows.length} timeline entries`);
    
    // Generate compact timeline markdown
    let timeline = "\n## X/Twitter Archive\n\n";
    let lastYear = "";
    for (const entry of entries.rows) {
      const year = entry.date instanceof Date 
        ? entry.date.getFullYear() 
        : new Date(entry.date).getFullYear();
      if (String(year) !== lastYear) {
        lastYear = String(year);
        timeline += `### ${year}\n\n`;
      }
      // Truncate detail to keep the page manageable
      const detail = (entry.detail || "").slice(0, 280).replace(/\n/g, " ");
      const dateStr = entry.date instanceof Date 
        ? entry.date.toISOString().slice(0, 10)
        : String(entry.date).slice(0, 10);
      timeline += `- **${dateStr}:** ${detail}\n`;
    }
    
    console.log(`Timeline markdown: ${timeline.length} chars`);
    
    // Update the page's timeline field
    await pool.query(
      `UPDATE pages SET timeline = $1, updated_at = NOW() WHERE slug = $2`,
      [timeline, PAGE_SLUG]
    );
    console.log("✅ Page timeline field updated");
    
    // Delete existing chunks so they get regenerated with the new timeline
    await pool.query(
      `DELETE FROM content_chunks WHERE page_id = $1`,
      [page.id]
    );
    console.log("✅ Old chunks deleted (will be regenerated on next embed)");
    
  } catch (err) {
    console.error("❌", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
