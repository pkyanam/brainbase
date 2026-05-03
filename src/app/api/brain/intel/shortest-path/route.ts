/**
 * GET /api/brain/intel/shortest-path?from=<slug>&to=<slug>&max_depth=6
 *
 * Returns the shortest path between two pages as an ordered list of hops
 * with link types. Uses native Cypher `shortestPath()` — always available
 * when Neo4j is configured (no GDS required).
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

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "Missing 'from' or 'to' parameter" }, { status: 400 });
  }
  const maxDepth = Math.min(parseInt(req.nextUrl.searchParams.get("max_depth") || "6"), 10);

  try {
    const { shortestPath } = await import("@/lib/neo4j/intel");
    const result = await shortestPath(auth.brainId, from, to, maxDepth);
    return NextResponse.json({ from, to, max_depth: maxDepth, ...result });
  } catch (err: any) {
    console.error("[brainbase/intel] shortest-path failed:", err?.message);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
