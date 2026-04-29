import { NextRequest, NextResponse } from "next/server";
import { traverseGraph } from "@/lib/supabase/write";
import { requireOwner } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const depth = parseInt(searchParams.get("depth") || "2", 10);
  const direction = (searchParams.get("direction") || "out") as "out" | "in" | "both";

  if (!slug) {
    return NextResponse.json({ error: "Missing 'slug' parameter" }, { status: 400 });
  }

  try {
    const results = await traverseGraph(auth.brainId, slug, Math.min(depth, 5), direction);
    return NextResponse.json({ slug, depth, direction, results });
  } catch (err) {
    console.error("[brainbase] Traverse error:", err);
    return NextResponse.json({ error: "Failed to traverse graph" }, { status: 500 });
  }
}
