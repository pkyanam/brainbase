import { queryOne, queryMany } from "./supabase/client";
import { ensureSchema, installBrainIdTriggers, ensureCollaborationSchema, ensureMinionsSchema } from "./db-setup";
import { encryptSupabaseKey, decryptSupabaseKey } from "./crypto";

/**
 * Get or create the brain for a given Clerk user ID.
 * Every user gets exactly one brain (auto-created on first access).
 */
export async function getBrainForUser(userId: string): Promise<string | null> {
  await ensureSchema();
  await installBrainIdTriggers();
  await ensureCollaborationSchema();
  await ensureMinionsSchema();
  const brain = await queryOne<{ id: string }>(
    `SELECT id FROM brains WHERE owner_user_id = $1 LIMIT 1`,
    [userId]
  );
  return brain?.id || null;
}

export async function getOrCreateBrainForUser(userId: string): Promise<string> {
  await ensureSchema();
  await installBrainIdTriggers();
  await ensureCollaborationSchema();
  await ensureMinionsSchema();
  const existing = await getBrainForUser(userId);
  if (existing) return existing;

  const result = await queryOne<{ id: string }>(
    `INSERT INTO brains (owner_user_id, name, slug)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, "My Brain", userId.slice(0, 8)]
  );
  if (!result) throw new Error("Failed to create brain");
  return result.id;
}

/**
 * v0.3 — Get all brains the user owns or is a member of.
 */
export async function getBrainsForUser(userId: string): Promise<Array<{ id: string; name: string; slug: string; role: string; is_owner: boolean }>> {
  await ensureCollaborationSchema();
  const rows = await queryMany<{
    id: string; name: string; slug: string; role: string; is_owner: boolean;
  }>(
    `SELECT b.id, b.name, b.slug,
            COALESCE(bm.role, 'owner') as role,
            (b.owner_user_id = $1) as is_owner
     FROM brains b
     LEFT JOIN brain_members bm ON bm.brain_id = b.id AND bm.user_id = $1
     WHERE b.owner_user_id = $1 OR bm.user_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Check if a user has access to a brain (owner or member).
 */
export async function canAccessBrain(userId: string, brainId: string): Promise<{ role: string; is_owner: boolean } | null> {
  await ensureCollaborationSchema();
  const row = await queryOne<{
    role: string; is_owner: boolean;
  }>(
    `SELECT COALESCE(bm.role, 'owner') as role,
            (b.owner_user_id = $1) as is_owner
     FROM brains b
     LEFT JOIN brain_members bm ON bm.brain_id = b.id AND bm.user_id = $1
     WHERE b.id = $2 AND (b.owner_user_id = $1 OR bm.user_id = $1)
     LIMIT 1`,
    [userId, brainId]
  );
  return row || null;
}

/**
 * Store encrypted Supabase credentials for a brain.
 * Encrypts the service key at rest using AES-256-GCM.
 */
export async function setBrainSupabaseCredentials(
  brainId: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  const enc = encryptSupabaseKey(supabaseKey);
  await queryOne(
    `UPDATE brains
     SET supabase_url = $1,
         encrypted_supabase_key = $2,
         encrypted_supabase_key_iv = $3,
         encrypted_supabase_key_tag = $4,
         supabase_key = NULL
     WHERE id = $5`,
    [supabaseUrl, enc.encrypted_supabase_key, enc.encrypted_supabase_key_iv, enc.encrypted_supabase_key_tag, brainId]
  );
}

/**
 * Delete a brain and all associated data. Only the owner can delete.
 */
export async function deleteBrain(brainId: string, userId: string): Promise<boolean> {
  const access = await canAccessBrain(userId, brainId);
  if (!access?.is_owner) return false;

  // Delete in dependency order — resilient to missing tables
  const deletes = [
    `DELETE FROM pages WHERE brain_id = $1`,
    `DELETE FROM brain_members WHERE brain_id = $1`,
    `DELETE FROM brain_invites WHERE brain_id = $1`,
    `DELETE FROM api_keys WHERE brain_id = $1`,
    `DELETE FROM activities WHERE brain_id = $1`,
    `DELETE FROM page_versions WHERE brain_id = $1`,
    `DELETE FROM timeline_entries WHERE brain_id = $1`,
    `DELETE FROM links WHERE brain_id = $1`,
    `DELETE FROM content_chunks WHERE brain_id = $1`,
    `DELETE FROM brains WHERE id = $1 AND owner_user_id = $2`,
  ];

  for (const sql of deletes) {
    try {
      await queryOne(sql, sql.includes('$2') ? [brainId, userId] : [brainId]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Only ignore "relation does not exist" errors; rethrow anything else
      if (!msg.includes('does not exist')) {
        throw err;
      }
    }
  }

  return true;
}
export async function getBrainSupabaseCredentials(
  brainId: string
): Promise<{ url: string; key: string } | null> {
  const row = await queryOne<{
    supabase_url: string;
    encrypted_supabase_key: string;
    encrypted_supabase_key_iv: string;
    encrypted_supabase_key_tag: string;
  }>(
    `SELECT supabase_url, encrypted_supabase_key, encrypted_supabase_key_iv, encrypted_supabase_key_tag
     FROM brains WHERE id = $1`,
    [brainId]
  );
  if (!row?.supabase_url || !row?.encrypted_supabase_key) return null;
  return {
    url: row.supabase_url,
    key: decryptSupabaseKey(row),
  };
}
