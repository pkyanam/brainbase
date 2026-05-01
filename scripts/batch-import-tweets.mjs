/**
 * Batch import all tweets from X archive into GBrain timeline_entries.
 * Run: node scripts/batch-import-tweets.mjs
 */
import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

// ── Config ──────────────────────────────────────────────
const gbrainConfig = JSON.parse(
  readFileSync(resolve(homedir(), ".gbrain", "config.json"), "utf-8")
);
const DB_URL = gbrainConfig.database_url;
const BRAIN_ID = "00000000-0000-0000-0000-000000000001";
const PAGE_SLUG = "preetham-kyanam";

if (!DB_URL) {
  console.error("No database_url in ~/.gbrain/config.json");
  process.exit(1);
}

// ── Parse X archive tweets.js ──────────────────────────────
function loadTweets() {
  const archivePath = resolve(
    process.env.HOME,
    "projects/brainbase/externalAssets/twitter-archive/data/tweets.js"
  );
  const raw = readFileSync(archivePath, "utf-8");
  // Twitter archive format: window.YTD.tweets.part0 = [...]
  // Strip the assignment and parse JSON
  const jsonStart = raw.indexOf("[");
  const jsonEnd = raw.lastIndexOf("]") + 1;
  const jsonStr = raw.slice(jsonStart, jsonEnd);
  return JSON.parse(jsonStr);
}

function summarizeTweet(tweet) {
  const full = tweet.tweet?.full_text || tweet.full_text || "";
  const text = full.replace(/\s+/g, " ").trim();
  const maxLen = 140;
  const summary = text.length > maxLen ? text.slice(0, maxLen - 3) + "..." : text;
  return { summary, detail: text };
}

function tweetDate(tweet) {
  const ts = tweet.tweet?.created_at || tweet.created_at;
  if (!ts) return null;
  // Twitter format: "Wed Oct 10 20:19:24 +0000 2018"
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── Main ──────────────────────────────────────────────
async function main() {
  const pool = new pg.Pool({
    connectionString: DB_URL,
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

  try {
    console.log("📖 Loading tweets from archive...");
    const tweets = loadTweets();
    console.log(`   Loaded ${tweets.length} tweets`);

    // Get page_id
    const pageResult = await pool.query(
      `SELECT id FROM pages WHERE slug = $1`,
      [PAGE_SLUG]
    );
    if (pageResult.rows.length === 0) {
      console.error(`❌ Page "${PAGE_SLUG}" not found`);
      process.exit(1);
    }
    const pageId = pageResult.rows[0].id;
    console.log(`   Page ID: ${pageId}`);

    // Check existing timeline entries to avoid duplicates
    const existingResult = await pool.query(
      `SELECT date, summary FROM timeline_entries WHERE page_id = $1 AND source = 'x-archive'`,
      [pageId]
    );
    const existing = new Set(
      existingResult.rows.map(r => `${r.date}|${r.summary}`)
    );
    console.log(`   Existing entries: ${existing.size}`);

    // Process tweets
    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    const batchSize = 50;
    let batch = [];

    for (const tweet of tweets) {
      const date = tweetDate(tweet);
      if (!date) continue;

      const { summary, detail } = summarizeTweet(tweet);
      if (!detail) continue;

      const key = `${date}|${summary}`;
      if (existing.has(key)) {
        skipped++;
        continue;
      }

      batch.push({
        brain_id: BRAIN_ID,
        page_id: pageId,
        date,
        summary,
        detail,
        source: "x-archive",
        written_by: "system",
      });

      if (batch.length >= batchSize) {
        await insertBatch(pool, batch);
        inserted += batch.length;
        batch = [];
        process.stdout.write(`\r   Inserted: ${inserted}, Skipped: ${skipped}`);
      }
    }

    // Final batch
    if (batch.length > 0) {
      await insertBatch(pool, batch);
      inserted += batch.length;
    }

    console.log(`\n✅ Done! Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);

  } catch (err) {
    console.error("❌ Fatal:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function insertBatch(pool, entries) {
  if (entries.length === 0) return;

  // Build multi-row VALUES
  const values = [];
  const params = [];
  let paramIdx = 1;

  for (const e of entries) {
    values.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6})`);
    params.push(e.brain_id, e.page_id, e.date, e.summary, e.detail, e.source, e.written_by);
    paramIdx += 7;
  }

  const query = `
    INSERT INTO timeline_entries (brain_id, page_id, date, summary, detail, source, written_by)
    VALUES ${values.join(", ")}
    ON CONFLICT DO NOTHING
  `;

  await pool.query(query, params);
}

main();
