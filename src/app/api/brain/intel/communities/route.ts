/**
 * GET /api/brain/intel/communities?limit=500
 *
 * Detects clusters in the graph via Louvain (Neo4j GDS). Returns one row per
 * page tagged with its community id. The dashboard colors nodes by community.
 *
 * Requires the GDS plugin. Reports `{ available: false }` when missing.
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

  const limit = Math.max(1, Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "500"), 5000));

  try {
    const { communities } = await import("@/lib/neo4j/intel");
    const result = await communities(auth.brainId, limit);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[brainbase/intel] communities failed:", err?.message);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
