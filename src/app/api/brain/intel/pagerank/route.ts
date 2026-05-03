/**
 * GET /api/brain/intel/pagerank?limit=25
 *
 * Returns the top-N most central pages in the brain. Uses Neo4j GDS PageRank
 * when available; falls back to degree centrality on bare Community.
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

  const limit = Math.max(1, Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "25"), 200));

  try {
    const { pageRank } = await import("@/lib/neo4j/intel");
    const result = await pageRank(auth.brainId, limit);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[brainbase/intel] pagerank failed:", err?.message);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
