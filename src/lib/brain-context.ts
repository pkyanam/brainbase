import { queryOne, queryMany } from "./supabase/client";
import { ensureSchema, installBrainIdTriggers, ensureCollaborationSchema } from "./db-setup";

/**
 * Get or create the brain for a given Clerk user ID.
 * Every user gets exactly one brain (auto-created on first access).
 */
export async function getBrainForUser(userId: string): Promise<string | null> {
  await ensureSchema();
  await installBrainIdTriggers();
  await ensureCollaborationSchema();
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
