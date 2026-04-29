import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { queryOne, queryMany } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  // List members and pending invites
  const members = await queryMany<{
    user_id: string;
    role: string;
    created_at: string;
  }>(
    `SELECT user_id, role, created_at::text
     FROM brain_members WHERE brain_id = $1`,
    [auth.brainId]
  );

  const invites = await queryMany<{
    id: string;
    email: string;
    role: string;
    created_at: string;
    expires_at: string;
  }>(
    `SELECT id, email, role, created_at::text, expires_at::text
     FROM brain_invites
     WHERE brain_id = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
    [auth.brainId]
  );

  return NextResponse.json({ members, invites, brain_id: auth.brainId });
}

export async function POST(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  if (!auth.isOwner) {
    return NextResponse.json({ error: "Only the brain owner can invite members" }, { status: 403 });
  }

  const { email, role = "editor" } = (await req.json().catch(() => ({}))) as {
    email?: string;
    role?: string;
  };

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const token = randomUUID();

  const invite = await queryOne<{
    id: string; email: string; token: string; role: string; expires_at: string;
  }>(
    `INSERT INTO brain_invites (brain_id, inviter_user_id, email, token, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, token, role, expires_at::text`,
    [auth.brainId, auth.userId, email.toLowerCase(), token, role]
  );

  await logActivity({
    brainId: auth.brainId,
    actorUserId: auth.userId,
    action: "invite_sent",
    entityType: "invite",
    entitySlug: email.toLowerCase(),
    metadata: { role },
  });

  return NextResponse.json({ invite });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  if (!auth.isOwner) {
    return NextResponse.json({ error: "Only the brain owner can manage members" }, { status: 403 });
  }

  const url = new URL(req.url);
  const memberUserId = url.searchParams.get("user_id");
  const inviteId = url.searchParams.get("invite_id");

  if (memberUserId) {
    await queryOne(
      `DELETE FROM brain_members WHERE brain_id = $1 AND user_id = $2 RETURNING id`,
      [auth.brainId, memberUserId]
    );
    return NextResponse.json({ success: true, removed: memberUserId });
  }

  if (inviteId) {
    await queryOne(
      `DELETE FROM brain_invites WHERE brain_id = $1 AND id = $2 RETURNING id`,
      [auth.brainId, inviteId]
    );
    return NextResponse.json({ success: true, cancelled: inviteId });
  }

  return NextResponse.json({ error: "user_id or invite_id required" }, { status: 400 });
}
