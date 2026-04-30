import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { getHealth } from "@/lib/supabase/health";

export async function GET(req: NextRequest) {
  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const health = await getHealth(auth.brainId);
    return NextResponse.json(health);
  } catch (err) {
    console.error("[brainbase] /api/health GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch brain health" },
      { status: 500 }
    );
  }
}
