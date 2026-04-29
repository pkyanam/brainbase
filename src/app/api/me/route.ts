import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";

/**
 * GET /api/me — returns the current user's Clerk ID.
 * Useful for setting OWNER_USER_ID env var.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    user_id: user.id,
    note: "Set OWNER_USER_ID=<this-value> in your environment to lock brain access to only you.",
  });
}
