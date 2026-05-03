/**
 * GET  /api/brain/graph-sync — read sync state for the current brain.
 * POST /api/brain/graph-sync — trigger a sync run. Body: { force_full?: boolean, limit?: number }
 *
 * Surfaces the Postgres → Neo4j projection status and lets the dashboard
 * "Re-sync graph" button kick off a backfill on demand.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { queryOne } from "@/lib/supabase/client";

interface SyncStateRow {
  brain_id: string;
  last_pages_synced_at: string | null;
  last_full_resync_at: string | null;
  pages_synced_total: string;
  edges_synced_total: string;
  last_status: string | null;
  last_error: string | null;
  updated_at: string | null;
}

export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof NextResponse) return auth;

  if (!process.env.NEO4J_URI) {
    return NextResponse.json({
      brain_id: auth.brainId,
      configured: false,
      reason: "NEO4J_URI not set — Neo4j projection is disabled",
    });
  }

  try {
    const row = await queryOne<SyncStateRow>(
      `SELECT brain_id::text, last_pages_synced_at::text, last_full_resync_at::text,
              pages_synced_total::text, edges_synced_total::text,
              last_status, last_error, updated_at::text
       FROM neo4j_sync_state WHERE brain_id = $1`,
      [auth.brainId]
    );

    return NextResponse.json({
      brain_id: auth.brainId,
      configured: true,
      state: row ?? null,
      mode: process.env.NEO4J_SINGLE_DB === "false" ? "multi-db" : "single-db",
    });
  } catch (err: any) {
    // Table may not exist yet (first run) — that's fine.
    if (String(err?.message ?? "").includes("does not exist")) {
      return NextResponse.json({
        brain_id: auth.brainId,
        configured: true,
        state: null,
        note: "Sync state table will be created on the first run",
      });
    }
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof NextResponse) return auth;

  if (!process.env.NEO4J_URI) {
    return NextResponse.json(
      { error: "NEO4J_URI not set — Neo4j projection is disabled" },
      { status: 400 }
    );
  }

  let body: { force_full?: boolean; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }

  const t0 = Date.now();
  try {
    const { syncBrainGraph } = await import("@/lib/neo4j/sync");
    const result = await syncBrainGraph(auth.brainId, {
      forceFull: !!body.force_full,
      limit: body.limit && body.limit > 0 ? body.limit : undefined,
    });
    return NextResponse.json({
      ...result,
      duration_ms: Date.now() - t0,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message ?? err), duration_ms: Date.now() - t0 },
      { status: 500 }
    );
  }
}
