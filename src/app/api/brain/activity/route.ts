import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { queryMany } from "@/lib/supabase/client";

export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const rows = await queryMany<{
    id: string;
    actor_user_id: string | null;
    action: string;
    entity_type: string;
    entity_slug: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>(
    `SELECT id, actor_user_id, action, entity_type, entity_slug, metadata, created_at::text
     FROM activities
     WHERE brain_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [auth.brainId, limit, offset]
  );

  return NextResponse.json({ activities: rows, limit, offset });
}
