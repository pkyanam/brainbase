/**
 * Add the missing pages_source_slug_key UNIQUE(source_id, slug) constraint
 * that GBrain's postgres-engine expects for ON CONFLICT (source_id, slug).
 * 
 * Brainbase's ensureSchema() created (brain_id, slug) instead, which doesn't match.
 * Run: node scripts/fix-constraint.mjs
 */
import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const gbrainConfig = JSON.parse(
  readFileSync(resolve(homedir(), ".gbrain", "config.json"), "utf-8")
);
const DB_URL = gbrainConfig.database_url;

if (!DB_URL) {
  console.error("No database_url in ~/.gbrain/config.json");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DB_URL,
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

async function main() {
  try {
    console.log("🔍 Current state:\n");
    
    // Check existing unique constraints on pages
    const constraints = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'pages'::regclass AND contype = 'u'
      ORDER BY conname
    `);
    
    for (const c of constraints.rows) {
      console.log(`  ${c.conname}: ${c.def}`);
    }
    
    // Check for duplicates on (source_id, slug)
    const dupes = await pool.query(`
      SELECT source_id, slug, COUNT(*) as n
      FROM pages
      GROUP BY source_id, slug
      HAVING COUNT(*) > 1
      LIMIT 10
    `);
    
    if (dupes.rows.length > 0) {
      console.log(`\n⚠️  Found ${dupes.rows.length} duplicate (source_id, slug) groups — fixing...`);
      for (const d of dupes.rows) {
        console.log(`  source_id=${d.source_id}, slug=${d.slug}, count=${d.n}`);
      }
    } else {
      console.log("\n✅ No duplicate (source_id, slug) rows.");
    }
    
    // Check source_id column
    const sourceIds = await pool.query(`
      SELECT source_id, COUNT(*) FROM pages GROUP BY source_id ORDER BY source_id
    `);
    console.log("\n📊 Pages by source_id:");
    for (const r of sourceIds.rows) {
      console.log(`  ${r.source_id}: ${r.count} pages`);
    }
    
    // Check if pages_source_slug_key already exists
    const hasSourceConstraint = constraints.rows.some(
      c => c.conname === 'pages_source_slug_key'
    );
    
    if (hasSourceConstraint) {
      console.log("\n✅ pages_source_slug_key already exists — no fix needed.");
    } else {
      console.log("\n🔧 Adding pages_source_slug_key UNIQUE (source_id, slug)...");
      await pool.query(`
        ALTER TABLE pages ADD CONSTRAINT pages_source_slug_key UNIQUE (source_id, slug)
      `);
      console.log("✅ Constraint added successfully!");
    }
    
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error("Detail:", err.detail || "");
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
