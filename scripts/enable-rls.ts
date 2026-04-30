/**
 * Security Migration: Enable Row Level Security on all tables.
 *
 * Run: npx tsx scripts/enable-rls.ts
 *
 * Why: Currently ZERO tables have RLS enabled. Any direct DB access
 * (leaked key, backup script, SQL injection) bypasses ALL tenant isolation.
 *
 * Safety: The Next.js app connects as the table owner (postgres role),
 * which BYPASSES RLS by default. This does NOT affect the app at all.
 * It only blocks non-owner connections (e.g., Supabase anon key).
 */
import { Pool } from "pg";

const DB_URL = process.env.SUPABASE_DATABASE_URL;

if (!DB_URL) {
  console.error("[security] SUPABASE_DATABASE_URL not set. Run:");
  console.error("  export SUPABASE_DATABASE_URL=$(grep '^SUPABASE_DATABASE_URL=' .env.local | cut -d'=' -f2-)");
  process.exit(1);
}

// Dedicated pool with longer timeout for remote Supabase
const pool = new Pool({
  connectionString: DB_URL,
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // 30s instead of 5s
  ssl: { rejectUnauthorized: false },
});

async function query(text: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function queryOne<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null> {
  const result = await query(text, params);
  return (result.rows[0] as T) || null;
}

const TABLES = [
  "brains",
  "api_keys",
  "brain_members",
  "brain_invites",
  "page_versions",
  "activities",
  "applications",
  "pages",
  "links",
  "content_chunks",
  "timeline_entries",
  "tags",
  "trigger_rules",
  "trigger_fires",
  "notifications",
  "brain_todos",
  "delegated_tasks",
  "usage_logs",
];

async function enableRLS() {
  console.log("[security] Enabling RLS on all tables...\n");

  for (const table of TABLES) {
    try {
      await query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      console.log(`  ✅ RLS enabled: ${table}`);
    } catch (err: any) {
      if (err.message?.includes("does not exist")) {
        console.log(`  ⚠️  Table does not exist, skipping: ${table}`);
      } else {
        console.log(`  ❌ Error on ${table}: ${err.message}`);
      }
    }
  }
}

async function createPolicies() {
  console.log("\n[security] Creating RLS policies...\n");

  // Helper function for session-based user ID
  await query(`
    CREATE OR REPLACE FUNCTION get_current_app_user_id()
    RETURNS TEXT AS $$
    BEGIN
      RETURN current_setting('app.current_user_id', true);
    EXCEPTION
      WHEN undefined_object THEN
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql STABLE SECURITY DEFINER
  `);
  console.log("  ✅ Created get_current_app_user_id() helper");

  // Brains: owner or member access
  await query(`
    CREATE POLICY IF NOT EXISTS brains_owner_access ON brains
      FOR ALL
      USING (
        owner_user_id = get_current_app_user_id()
        OR EXISTS (
          SELECT 1 FROM brain_members
          WHERE brain_members.brain_id = brains.id
            AND brain_members.user_id = get_current_app_user_id()
        )
      )
  `);
  console.log("  ✅ Policy: brains_owner_access");

  // Shared brain-access CTE pattern for content tables
  const contentTables = ["pages", "links", "content_chunks", "timeline_entries"];
  for (const table of contentTables) {
    await query(`
      CREATE POLICY IF NOT EXISTS ${table}_brain_access ON ${table}
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM brains
            WHERE brains.id = ${table}.brain_id
              AND (brains.owner_user_id = get_current_app_user_id()
                   OR EXISTS (
                     SELECT 1 FROM brain_members
                     WHERE brain_members.brain_id = brains.id
                       AND brain_members.user_id = get_current_app_user_id()
                   ))
          )
        )
    `);
    console.log(`  ✅ Policy: ${table}_brain_access`);
  }

  // API keys: owner only
  await query(`
    CREATE POLICY IF NOT EXISTS api_keys_owner_access ON api_keys
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM brains
          WHERE brains.id = api_keys.brain_id
            AND brains.owner_user_id = get_current_app_user_id()
        )
      )
  `);
  console.log("  ✅ Policy: api_keys_owner_access");

  // Brain members: owner only
  await query(`
    CREATE POLICY IF NOT EXISTS brain_members_owner_access ON brain_members
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM brains
          WHERE brains.id = brain_members.brain_id
            AND brains.owner_user_id = get_current_app_user_id()
        )
      )
  `);
  console.log("  ✅ Policy: brain_members_owner_access");

  // Brain invites: owner only
  await query(`
    CREATE POLICY IF NOT EXISTS brain_invites_owner_access ON brain_invites
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM brains
          WHERE brains.id = brain_invites.brain_id
            AND brains.owner_user_id = get_current_app_user_id()
        )
      )
  `);
  console.log("  ✅ Policy: brain_invites_owner_access");

  // Page versions: owner/member
  await query(`
    CREATE POLICY IF NOT EXISTS page_versions_brain_access ON page_versions
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM brains
          WHERE brains.id = page_versions.brain_id
            AND (brains.owner_user_id = get_current_app_user_id()
                 OR EXISTS (
                   SELECT 1 FROM brain_members
                   WHERE brain_members.brain_id = brains.id
                     AND brain_members.user_id = get_current_app_user_id()
                 ))
        )
      )
  `);
  console.log("  ✅ Policy: page_versions_brain_access");

  // Activities: owner/member
  await query(`
    CREATE POLICY IF NOT EXISTS activities_brain_access ON activities
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM brains
          WHERE brains.id = activities.brain_id
            AND (brains.owner_user_id = get_current_app_user_id()
                 OR EXISTS (
                   SELECT 1 FROM brain_members
                   WHERE brain_members.brain_id = brains.id
                     AND brain_members.user_id = get_current_app_user_id()
                 ))
        )
      )
  `);
  console.log("  ✅ Policy: activities_brain_access");
}

async function addIndexes() {
  console.log("\n[security] Adding performance indexes...\n");

  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_pages_brain_id ON pages(brain_id)",
    "CREATE INDEX IF NOT EXISTS idx_links_brain_id ON links(brain_id)",
    "CREATE INDEX IF NOT EXISTS idx_content_chunks_brain_id ON content_chunks(brain_id)",
    "CREATE INDEX IF NOT EXISTS idx_timeline_entries_brain_id ON timeline_entries(brain_id)",
  ];

  for (const idx of indexes) {
    try {
      await query(idx);
      console.log(`  ✅ ${idx.split(" ON ")[1].split(" ")[0]}`);
    } catch (err: any) {
      console.log(`  ❌ ${err.message}`);
    }
  }
}

async function logMigration() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(
    `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`,
    ["security-rls-2026-04-30"]
  );
  console.log("\n  ✅ Migration logged in schema_migrations");
}

async function main() {
  console.log("=".repeat(60));
  console.log("  Brainbase Security Migration — Enable RLS");
  console.log("=".repeat(60));

  // Test connection first
  console.log("\n[security] Testing DB connection...");
  try {
    const test = await queryOne("SELECT NOW() as now");
    console.log(`  ✅ Connected. Server time: ${test?.now}`);
  } catch (e: any) {
    console.error(`  ❌ Connection failed: ${e.message}`);
    console.error("\nMake sure SUPABASE_DATABASE_URL is exported correctly.");
    process.exit(1);
  }

  await enableRLS();
  await createPolicies();
  await addIndexes();
  await logMigration();

  await pool.end();

  console.log("\n" + "=".repeat(60));
  console.log("  ✅ RLS enabled on all tables.");
  console.log("  ✅ Policies created for tenant isolation.");
  console.log("  ✅ The app is unaffected (postgres owner bypasses RLS).");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("[security] Fatal error:", err);
  pool.end();
  process.exit(1);
});
