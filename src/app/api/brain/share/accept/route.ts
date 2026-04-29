import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { queryOne } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest) {
  const userId = await requireAuth();
  if (typeof userId !== "string") return userId;

  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) {
    return NextResponse.json({ error: "Invite token required" }, { status: 400 });
  }

  const invite = await queryOne<{
    id: string; brain_id: string; role: string; email: string;
  }>(
    `SELECT id, brain_id, role, email FROM brain_invites
     WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [token]
  );

  if (!invite) {
    return NextResponse.json({ error: "Invite not found or expired" }, { status: 404 });
  }

  // Add member
  await queryOne(
    `INSERT INTO brain_members (brain_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (brain_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING id`,
    [invite.brain_id, userId, invite.role]
  );

  // Mark invite accepted
  await queryOne(
    `UPDATE brain_invites SET accepted_at = NOW() WHERE id = $1`,
    [invite.id]
  );

  await logActivity({
    brainId: invite.brain_id,
    actorUserId: userId,
    action: "member_joined",
    entityType: "brain",
    metadata: { role: invite.role },
  });

  return NextResponse.json({ success: true, brain_id: invite.brain_id });
}
