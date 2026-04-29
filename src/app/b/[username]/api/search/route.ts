import { NextRequest, NextResponse } from "next/server";
import { searchBrain } from "@/lib/supabase/search";
import { requireOwner } from "@/lib/auth-guard";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  const { username } = await params;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json(
      { error: "q required", example: `/b/${username}/api/search?q=preetham` },
      { status: 400 }
    );
  }

  try {
    const results = await searchBrain(auth.brainId, q);
    return NextResponse.json({
      brain: username,
      query: q,
      results,
      total: results.length,
    });
  } catch (err) {
    console.error("[brainbase] Search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
