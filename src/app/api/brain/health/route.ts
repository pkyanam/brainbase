import { NextResponse } from "next/server";
import { getHealth } from "@/lib/supabase/health";
import { requireOwner } from "@/lib/auth-guard";

export async function GET() {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  try {
    const health = await getHealth(auth.brainId);
    return NextResponse.json(health);
  } catch (err) {
    console.error("[brainbase] Health endpoint error:", err);
    return NextResponse.json(
      { error: "Failed to fetch brain health" },
      { status: 500 }
    );
  }
}
