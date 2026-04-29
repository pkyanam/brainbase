import { createHash, randomBytes } from "crypto";
import { queryOne, queryMany } from "./supabase/client";
import { ensureSchema } from "./db-setup";

const KEY_PREFIX = "bb_live_";

export interface ApiKeyRecord {
  id: string;
  brain_id: string;
  user_id: string;
  key_prefix: string;
  name: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function generateKey(): string {
  const random = randomBytes(32).toString("base64url");
  return `${KEY_PREFIX}${random}`;
}

/**
 * Create a new API key for a user/brain.
 * Returns the raw key (shown once) and the stored record.
 */
export async function createApiKey(
  userId: string,
  brainId: string,
  name?: string
): Promise<{ rawKey: string; record: ApiKeyRecord }> {
  await ensureSchema();

  const rawKey = generateKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 16);

  const record = await queryOne<ApiKeyRecord>(
    `INSERT INTO api_keys (brain_id, user_id, key_prefix, key_hash, name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, brain_id, user_id, key_prefix, name, created_at, last_used_at, revoked_at`,
    [brainId, userId, keyPrefix, keyHash, name || null]
  );

  if (!record) throw new Error("Failed to create API key");

  return { rawKey, record };
}

/**
 * List all active API keys for a user.
 */
export async function listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
  await ensureSchema();

  return queryMany<ApiKeyRecord>(
    `SELECT id, brain_id, user_id, key_prefix, name, created_at, last_used_at, revoked_at
     FROM api_keys
     WHERE user_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [userId]
  );
}

/**
 * Revoke an API key.
 */
export async function revokeApiKey(userId: string, keyId: string): Promise<void> {
  await queryOne(
    `UPDATE api_keys
     SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [keyId, userId]
  );
}

/**
 * Validate an API key and return the associated brain_id.
 * Also updates last_used_at.
 */
export async function validateApiKey(
  key: string
): Promise<{ brainId: string; userId: string; keyId: string } | null> {
  if (!key.startsWith(KEY_PREFIX)) return null;

  await ensureSchema();

  const keyHash = hashKey(key);

  const record = await queryOne<{
    id: string; brain_id: string; user_id: string;
  }>(
    `SELECT id, brain_id, user_id
     FROM api_keys
     WHERE key_hash = $1 AND revoked_at IS NULL`,
    [keyHash]
  );

  if (!record) return null;

  // Update last_used_at asynchronously (fire and forget)
  queryOne(
    `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
    [record.id]
  ).catch(() => {});

  return { brainId: record.brain_id, userId: record.user_id, keyId: record.id };
}

/**
 * Get or create the default brain for a user.
 */
export async function getOrCreateBrain(userId: string): Promise<{ id: string; slug: string }> {
  await ensureSchema();

  const existing = await queryOne<{ id: string; slug: string }>(
    `SELECT id, slug FROM brains WHERE owner_user_id = $1 LIMIT 1`,
    [userId]
  );

  if (existing) return existing;

  // Generate a slug from userId (first 8 chars)
  const slug = userId.slice(0, 8);

  const created = await queryOne<{ id: string; slug: string }>(
    `INSERT INTO brains (owner_user_id, name, slug)
     VALUES ($1, $2, $3)
     RETURNING id, slug`,
    [userId, "My Brain", slug]
  );

  if (!created) throw new Error("Failed to create brain");
  return created;
}
