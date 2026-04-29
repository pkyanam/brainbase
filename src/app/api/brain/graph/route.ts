import { NextResponse } from "next/server";
import { getGraphData } from "@/lib/supabase/graph";
import { requireOwner } from "@/lib/auth-guard";

export async function GET() {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  try {
    const data = await getGraphData(auth.brainId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[brainbase] Graph endpoint error:", err);
    return NextResponse.json(
      { error: "Failed to fetch graph data" },
      { status: 500 }
    );
  }
}
