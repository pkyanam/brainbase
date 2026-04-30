import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { traverseGraph } from "@/lib/supabase/write";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const depth = Math.min(parseInt(searchParams.get("depth") || "2", 10), 5);
  const direction = (searchParams.get("direction") || "out") as
    | "out"
    | "in"
    | "both";

  try {
    const results = await traverseGraph(auth.brainId, slug, depth, direction);
    return NextResponse.json({ slug, depth, direction, results });
  } catch (err) {
    console.error("[brainbase] /api/graph/[slug] GET error:", err);
    return NextResponse.json(
      { error: "Failed to traverse graph" },
      { status: 500 }
    );
  }
}
