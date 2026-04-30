/**
 * Encrypt sensitive secrets stored in plain text.
 *
 * Run: ENCRYPTION_KEY=your-32-char-key npx tsx scripts/encrypt-secrets.ts
 *
 * What this encrypts:
 * - brains.supabase_key → brains.encrypted_supabase_key (AES-256-GCM)
 * - brain_invites.token → brain_invites.token_hash (SHA-256)
 *
 * Why: Currently both are stored in plain text. If the DB is compromised,
 * an attacker gets full Supabase admin access to every customer's brain.
 *
 * The ENCRYPTION_KEY must be 32 bytes. Store it in Vercel env vars.
 * NEVER commit it. Rotate it if leaked.
 */
import crypto from "crypto";
import { Pool } from "pg";

const ENCRYPTION_KEY = process.env.BRAINBASE_ENCRYPTION_KEY;
const DB_URL = process.env.SUPABASE_DATABASE_URL;

if (!DB_URL) {
  console.error("[encrypt] SUPABASE_DATABASE_URL not set. Run:");
  console.error("  export SUPABASE_DATABASE_URL=$(grep '^SUPABASE_DATABASE_URL=' .env.local | cut -d'=' -f2-)");
  process.exit(1);
}

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  console.error("[encrypt] Set BRAINBASE_ENCRYPTION_KEY to exactly 32 characters");
  console.error("  Generate one: node -e \"console.log(require('crypto').randomBytes(16).toString('hex'))\"");
  process.exit(1);
}

// Dedicated pool with longer timeout for remote Supabase
// If connection string has sslmode, don't override it
const pool = new Pool({
  connectionString: DB_URL,
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // 30s instead of 5s
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

const ALGORITHM = "aes-256-gcm";

function encrypt(text: string): { ciphertext: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY!, iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function encryptSupabaseKeys() {
  console.log("[encrypt] Checking brains.supabase_key...\n");

  // Add encrypted column if not exists
  const colCheck = await queryOne(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = 'brains' AND column_name = 'encrypted_supabase_key'`
  );

  if (!colCheck) {
    await query(`
      ALTER TABLE brains
      ADD COLUMN IF NOT EXISTS encrypted_supabase_key TEXT,
      ADD COLUMN IF NOT EXISTS encrypted_supabase_key_iv TEXT,
      ADD COLUMN IF NOT EXISTS encrypted_supabase_key_tag TEXT
    `);
    console.log("  ✅ Added encrypted_supabase_key columns to brains");
  } else {
    console.log("  ✅ encrypted_supabase_key columns already exist");
  }

  // Encrypt existing keys
  const rows = await query(
    `SELECT id, supabase_key FROM brains
     WHERE supabase_key IS NOT NULL AND encrypted_supabase_key IS NULL`
  );

  console.log(`  → Found ${rows.rowCount} brains with plain-text keys to encrypt`);

  for (const row of rows.rows) {
    if (!row.supabase_key) continue;
    const encrypted = encrypt(row.supabase_key);
    await query(
      `UPDATE brains SET
        encrypted_supabase_key = $1,
        encrypted_supabase_key_iv = $2,
        encrypted_supabase_key_tag = $3,
        supabase_key = NULL
      WHERE id = $4`,
      [encrypted.ciphertext, encrypted.iv, encrypted.tag, row.id]
    );
    console.log(`  ✅ Encrypted key for brain ${row.id}`);
  }

  if (rows.rowCount === 0) {
    console.log("  ✅ No plain-text keys found (already encrypted or none set)");
  }
}

async function hashInviteTokens() {
  console.log("\n[encrypt] Checking brain_invites.token...\n");

  // Add hash column if not exists
  const colCheck = await queryOne(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = 'brain_invites' AND column_name = 'token_hash'`
  );

  if (!colCheck) {
    await query(`ALTER TABLE brain_invites ADD COLUMN token_hash TEXT`);
    console.log("  ✅ Added token_hash column to brain_invites");
  } else {
    console.log("  ✅ token_hash column already exists");
  }

  // Hash existing tokens
  const rows = await query(
    `SELECT id, token FROM brain_invites
     WHERE token IS NOT NULL AND token_hash IS NULL`
  );

  console.log(`  → Found ${rows.rowCount} invites with plain-text tokens to hash`);

  for (const row of rows.rows) {
    if (!row.token) continue;
    const hashed = hashToken(row.token);
    await query(
      `UPDATE brain_invites SET token_hash = $1, token = NULL WHERE id = $2`,
      [hashed, row.id]
    );
    console.log(`  ✅ Hashed token for invite ${row.id}`);
  }

  if (rows.rowCount === 0) {
    console.log("  ✅ No plain-text tokens found (already hashed or none set)");
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("  Brainbase Secret Encryption Migration");
  console.log("=".repeat(60));

  // Test connection first
  console.log("\n[encrypt] Testing DB connection...");
  try {
    const test = await queryOne("SELECT NOW() as now");
    console.log(`  ✅ Connected. Server time: ${test?.now}`);
  } catch (e: any) {
    console.error(`  ❌ Connection failed: ${e.message}`);
    console.error("\nMake sure SUPABASE_DATABASE_URL is exported correctly.");
    pool.end();
    process.exit(1);
  }

  await encryptSupabaseKeys();
  await hashInviteTokens();

  await pool.end();

  console.log("\n" + "=".repeat(60));
  console.log("  ✅ Migration complete.");
  console.log("  IMPORTANT: Add BRAINBASE_ENCRYPTION_KEY to Vercel env vars!");
  console.log("  IMPORTANT: Update app code to use encrypted fields!");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("[encrypt] Fatal error:", err);
  pool.end();
  process.exit(1);
});
