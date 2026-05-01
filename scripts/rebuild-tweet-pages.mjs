/**
 * Rebuild X archive import: per-tweet pages with proper frontmatter.
 * Slug: tweets/pkyanam-YYYY-MM-DD-NNN
 * Frontmatter: date, tweet_id, url, ordinal, is_reply, is_retweet
 * Also creates mentioned links to contact pages.
 * 
 * Run: node scripts/rebuild-tweet-pages.mjs
 */
import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const gbrainConfig = JSON.parse(
  readFileSync(resolve(homedir(), ".gbrain", "config.json"), "utf-8")
);
const DB_URL = gbrainConfig.database_url;
const BRAIN_ID = "00000000-0000-0000-0000-000000000001";

const pool = new pg.Pool({
  connectionString: DB_URL,
  max: 4,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

// ── Parse tweets.js ────────────────────────────────────
function loadTweets() {
  const archivePath = resolve(
    homedir(),
    "projects/brainbase/externalAssets/twitter-archive/data/tweets.js"
  );
  const raw = readFileSync(archivePath, "utf-8");
  const jsonStart = raw.indexOf("[");
  const jsonEnd = raw.lastIndexOf("]") + 1;
  return JSON.parse(raw.slice(jsonStart, jsonEnd));
}

function extractTweet(tweet) {
  const t = tweet.tweet || tweet;
  const fullText = (t.full_text || "").replace(/\s+/g, " ").trim();
  const created = t.created_at;
  if (!created || !fullText) return null;
  
  const d = new Date(created);
  if (isNaN(d.getTime())) return null;
  
  const dateStr = d.toISOString().slice(0, 10);
  const tweetId = t.id_str || String(t.id || "");
  
  // Extract @mentions from text
  const mentions = [...fullText.matchAll(/@(\w{1,15})/g)].map(m => m[1].toLowerCase());
  
  // Determine tweet type
  const isRetweet = fullText.startsWith("RT @");
  const isReply = fullText.startsWith("@") && !isRetweet;
  
  return {
    fullText,
    dateStr,
    tweetId,
    mentions,
    isRetweet,
    isReply,
    timestamp: d.getTime(),
  };
}

// ── Slug generation ────────────────────────────────────
function makeSlug(dateStr, ordinal) {
  return `tweets/pkyanam-${dateStr}-${String(ordinal).padStart(3, "0")}`;
}

// ── Main ───────────────────────────────────────────────
async function main() {
  try {
    console.log("📖 Loading tweets...");
    const rawTweets = loadTweets();
    const tweets = rawTweets
      .map(extractTweet)
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp); // chronological
    
    console.log(`   ${tweets.length} valid tweets (chronological order)`);
    
    // Assign ordinals and compute slugs
    const dateOrdinals = new Map(); // dateStr → next ordinal
    tweets.forEach((t, i) => { 
      t.ordinal = i + 1;
      const dayOrdinal = (dateOrdinals.get(t.dateStr) || 0) + 1;
      dateOrdinals.set(t.dateStr, dayOrdinal);
      t.slug = makeSlug(t.dateStr, dayOrdinal);
    });
    
    // ── Phase 1: Create tweet pages ─────────────────────
    console.log("\n── Creating tweet pages ──");
    let created = 0;
    let skipped = 0;
    let errors = 0;
    const BATCH = 100;
    let batch = [];
    
    for (const tweet of tweets) {
      const slug = tweet.slug;
      const title = `Tweet #${tweet.ordinal} — ${tweet.dateStr}`;
      
      const frontmatter = {
        type: "tweet",
        source: "x-archive",
        date: tweet.dateStr,
        tweet_id: tweet.tweetId,
        url: tweet.tweetId ? `https://x.com/pkyanam/status/${tweet.tweetId}` : "",
        ordinal: tweet.ordinal,
        is_reply: tweet.isReply,
        is_retweet: tweet.isRetweet,
        mentions: tweet.mentions,
      };
      
      const body = `# ${title}\n\n${tweet.fullText}\n\n- **Ordinal:** ${tweet.ordinal}\n- **Date:** ${tweet.dateStr}\n- **Type:** ${tweet.isRetweet ? "Retweet" : tweet.isReply ? "Reply" : "Original"}\n- **URL:** ${frontmatter.url}`;
      
      batch.push({
        slug,
        brain_id: BRAIN_ID,
        title,
        type: "tweet",
        compiled_truth: body,
        frontmatter: JSON.stringify(frontmatter),
      });
      
      if (batch.length >= BATCH) {
        const result = await insertBatch(pool, batch);
        created += result.created;
        skipped += result.skipped;
        errors += result.errors;
        batch = [];
        process.stdout.write(`\r   ${created} created, ${skipped} skipped, ${errors} errors`);
      }
    }
    
    // Final batch
    if (batch.length > 0) {
      const result = await insertBatch(pool, batch);
      created += result.created;
      skipped += result.skipped;
      errors += result.errors;
    }
    
    console.log(`\n✅ Tweet pages: ${created} created, ${skipped} skipped, ${errors} errors`);
    
    // ── Phase 2: Create mentioned links ──────────────────
    console.log("\n── Creating mentioned links ──");
    let linksCreated = 0;
    let linksSkipped = 0;
    
    for (const tweet of tweets) {
      if (tweet.mentions.length === 0) continue;
      const slug = tweet.slug;
      
      for (const handle of tweet.mentions) {
        // Find contact page for this handle
        const contactSlug = resolveContactSlug(handle);
        if (!contactSlug) continue;
        
        try {
          await pool.query(
            `INSERT INTO links (brain_id, from_page_id, to_page_id, link_type, written_by)
             VALUES (
               $1,
               (SELECT id FROM pages WHERE slug = $2),
               (SELECT id FROM pages WHERE slug = $3),
               'mentioned', 'system'
             )
             ON CONFLICT DO NOTHING`,
            [BRAIN_ID, slug, contactSlug]
          );
          linksCreated++;
        } catch {
          linksSkipped++;
        }
      }
    }
    
    console.log(`✅ Links: ${linksCreated} created, ${linksSkipped} skipped`);
    
    // ── Phase 3: Clean up old timeline backfill ──────────
    console.log("\n── Cleaning up old timeline field ──");
    await pool.query(
      `UPDATE pages SET timeline = '' WHERE slug = 'preetham-kyanam'`
    );
    await pool.query(
      `DELETE FROM content_chunks WHERE page_id = (SELECT id FROM pages WHERE slug = 'preetham-kyanam')`
    );
    console.log("✅ Old timeline field cleared, chunks deleted");
    
    console.log("\n🏁 Rebuild complete! Run: gbrain embed --stale");
    
  } catch (err) {
    console.error("❌ Fatal:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// ── Batch insert with ON CONFLICT ───────────────────────
async function insertBatch(pool, entries) {
  if (entries.length === 0) return { created: 0, skipped: 0, errors: 0 };
  
  const values = [];
  const params = [];
  let idx = 1;
  
  for (const e of entries) {
    values.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}::jsonb, $${idx+6})`);
    params.push(e.brain_id, e.slug, e.title, e.type, e.compiled_truth, e.frontmatter, 'system');
    idx += 7;
  }
  
  try {
    await pool.query(
      `INSERT INTO pages (brain_id, slug, title, type, compiled_truth, frontmatter, written_by)
       VALUES ${values.join(", ")}
       ON CONFLICT (source_id, slug) DO UPDATE SET
         title = EXCLUDED.title,
         compiled_truth = EXCLUDED.compiled_truth,
         frontmatter = EXCLUDED.frontmatter,
         updated_at = NOW()`,
      params
    );
    return { created: entries.length, skipped: 0, errors: 0 };
  } catch (err) {
    console.error(`\n   Batch error: ${err.message}`);
    return { created: 0, skipped: 0, errors: entries.length };
  }
}

// ── Contact slug resolution ─────────────────────────────
function resolveContactSlug(handle) {
  const map = {
    "cursor_ai": "companies/cursor",
    "theo": "theo-browne",
    "yacinemtb": "yacine",
    "rajmocherla": "raj-mocherla",
    "npmjs": "companies/npm",
    "jayair": "jayair",
    "ethanlipnik": "ethan-lipnik",
    "tereza_tizkova": "tereza-tizkova",
    "nbcwashington": "nbc-washington",
    "garrytan": "garry-tan",
    "elonmusk": "elon-musk",
    "cloudflare": "companies/cloudflare",
    "vercel": "companies/vercel",
    "cursor": "companies/cursor",
    "deepseek_ai": "deepseek",
    "nousresearch": "nous-research",
    "opencode": "opencode",
    "mintlify": "companies/mintlify",
    "kalshi": "companies/kalshi",
    "lmstudio": "lm-studio",
    "xai": "companies/xai",
    "anthropicai": "companies/anthropic",
    "openai": "companies/openai",
  };
  return map[handle] || null;
}

main();
