import { queryOne } from "./supabase/client";
import { ensureSchema, installBrainIdTriggers } from "./db-setup";

/**
 * Get or create the brain for a given Clerk user ID.
 * Every user gets exactly one brain (auto-created on first access).
 */
export async function getBrainForUser(userId: string): Promise<string | null> {
  await ensureSchema();
  await installBrainIdTriggers();
  const brain = await queryOne<{ id: string }>(
    `SELECT id FROM brains WHERE owner_user_id = $1 LIMIT 1`,
    [userId]
  );
  return brain?.id || null;
}

export async function getOrCreateBrainForUser(userId: string): Promise<string> {
  await ensureSchema();
  await installBrainIdTriggers();
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
