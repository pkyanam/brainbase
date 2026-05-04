/**
 * Debug endpoint for Neo4j GDS detection.
 * GET /api/debug/neo4j — tests GDS availability and returns diagnostic info.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof NextResponse) return auth;

  const diagnostics: Record<string, unknown> = {
    neo4j_uri: !!process.env.NEO4J_URI,
    single_db_mode: process.env.NEO4J_SINGLE_DB,
    brain_id: auth.brainId,
  };

  if (!process.env.NEO4J_URI) {
    return NextResponse.json({
      ...diagnostics,
      error: "NEO4J_URI not set",
    });
  }

  try {
    // Test 1: Basic connection
    const { runQuery } = await import("@/lib/neo4j/driver");
    const pingResult = await runQuery(auth.brainId, "RETURN 1 AS ok");
    diagnostics.ping = pingResult[0];

    // Test 2: GDS version check
    try {
      const gdsResult = await runQuery(auth.brainId, "RETURN gds.version() AS version");
      diagnostics.gds_version = gdsResult[0]?.version;
      diagnostics.gds_available = true;
    } catch (gdsErr: any) {
      diagnostics.gds_available = false;
      diagnostics.gds_error = gdsErr?.message || String(gdsErr);
    }

    // Test 3: List available procedures
    try {
      const procs = await runQuery(auth.brainId, "SHOW PROCEDURES YIELD name WHERE name STARTS WITH 'gds' RETURN name ORDER BY name LIMIT 20");
      diagnostics.gds_procedures = procs.map((p: any) => p.name);
    } catch (procErr: any) {
      diagnostics.procedures_error = procErr?.message || String(procErr);
    }

    // Test 4: Check if GDS is installed but not enabled
    try {
      const enabled = await runQuery(auth.brainId, "RETURN gds.list().graphName AS graph LIMIT 1");
      diagnostics.gds_enabled_graphs = enabled;
    } catch (enabledErr: any) {
      diagnostics.gds_enabled_check = enabledErr?.message || String(enabledErr);
    }
  } catch (err: any) {
    diagnostics.error = err?.message || String(err);
  }

  return NextResponse.json(diagnostics);
}
