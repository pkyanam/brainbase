import { NextResponse } from "next/server";
import { getStats } from "@/lib/supabase/write";
import { requireOwner } from "@/lib/auth-guard";

export async function GET() {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  try {
    const stats = await getStats(auth.brainId);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[brainbase] Stats endpoint error:", err);
    return NextResponse.json({ error: "Failed to get stats" }, { status: 500 });
  }
}
