/**
 * GET /api/brain/intel/similar?slug=<slug>&limit=10
 *
 * Returns the pages most structurally similar to the given page, based on
 * shared neighbors in the graph. Uses GDS node-similarity when available;
 * falls back to a Jaccard computation in pure Cypher otherwise.
 *
 * "Similar" here is graph-structural, not text-semantic. For text similarity
 * use the search endpoint with vector mode.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof NextResponse) return auth;

  if (!process.env.NEO4J_URI) {
    return NextResponse.json(
      { error: "neo4j_not_configured", reason: "Set NEO4J_URI to enable graph intelligence." },
      { status: 503 }
    );
  }

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing 'slug' parameter" }, { status: 400 });
  }
  const limit = Math.max(1, Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "10"), 100));

  try {
    const { similarPages } = await import("@/lib/neo4j/intel");
    const result = await similarPages(auth.brainId, slug, limit);
    return NextResponse.json({ slug, limit, ...result });
  } catch (err: any) {
    console.error("[brainbase/intel] similar failed:", err?.message);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
