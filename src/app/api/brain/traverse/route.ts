import { NextRequest, NextResponse } from "next/server";
import { traverseGraph } from "@/lib/graph-router";
import { requireOwner } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing 'slug' parameter" }, { status: 400 });
  }

  const depth = Math.min(parseInt(searchParams.get("depth") || "2"), 10);
  const direction = (searchParams.get("direction") || "out") as "out" | "in" | "both";
  const linkType = searchParams.get("link_type") || undefined;

  try {
    const { data, backend, fellBack } = await traverseGraph(
      auth.brainId,
      slug,
      depth,
      direction,
      linkType
    );
    return NextResponse.json({
      slug,
      depth,
      direction,
      linkType,
      results: data,
      _backend: backend,
      _fell_back: fellBack,
    });
  } catch (err) {
    console.error("[brainbase] Traverse error:", err);
    return NextResponse.json({ error: "Failed to traverse graph" }, { status: 500 });
  }
}
