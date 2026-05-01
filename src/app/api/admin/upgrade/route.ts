import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-guard";
import { query } from "@/lib/supabase/client";

/**
 * POST /api/admin/upgrade
 *
 * Manually upgrade a user's brain plan. Owner-only.
 *
 * Body: { user_id: string, plan: "free" | "pro" | "unlimited" }
 */
export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const { user_id, plan } = body;

    if (!user_id || !plan) {
      return NextResponse.json(
        { error: "user_id and plan are required" },
        { status: 400 }
      );
    }

    if (!["free", "pro", "unlimited"].includes(plan)) {
      return NextResponse.json(
        { error: "plan must be free, pro, or unlimited" },
        { status: 400 }
      );
    }

    await query(
      `UPDATE brains SET plan = $1 WHERE owner_user_id = $2`,
      [plan, user_id]
    );

    return NextResponse.json({ success: true, user_id, plan });
  } catch (err) {
    console.error("[brainbase] Upgrade error:", err);
    return NextResponse.json(
      { error: "Failed to upgrade user" },
      { status: 500 }
    );
  }
}
