import { query } from "./supabase/client";

export type ActionType = "page_created" | "page_updated" | "page_deleted" | "link_created" | "link_deleted" | "timeline_added" | "member_joined" | "invite_sent";
export type EntityType = "page" | "link" | "timeline" | "brain" | "invite";

interface LogActivityInput {
  brainId: string;
  actorUserId?: string;
  action: ActionType;
  entityType: EntityType;
  entitySlug?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await query(
      `INSERT INTO activities (brain_id, actor_user_id, action, entity_type, entity_slug, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.brainId,
        input.actorUserId || null,
        input.action,
        input.entityType,
        input.entitySlug || null,
        JSON.stringify(input.metadata || {}),
      ]
    );
  } catch (err) {
    console.error("[brainbase] Activity log error:", err);
  }
}
