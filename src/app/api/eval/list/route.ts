/**
 * GET /api/eval/list — list eval runs
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/auth-guard";
import { query } from "@/lib/supabase/client";

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── Force-create eval tables inline (belt-and-suspenders) ──
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS eval_runs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          brain_id UUID NOT NULL,
          status TEXT NOT NULL DEFAULT 'running',
          total_queries INTEGER DEFAULT 0,
          avg_mrr DOUBLE PRECISION,
          avg_p3 DOUBLE PRECISION,
          avg_p5 DOUBLE PRECISION,
          avg_latency_ms DOUBLE PRECISION,
          passed INTEGER DEFAULT 0,
          failed INTEGER DEFAULT 0,
          baseline_id UUID,
          meta JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          completed_at TIMESTAMPTZ
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_eval_runs_brain ON eval_runs(brain_id, created_at DESC)`);
    } catch (e) {
      console.error("[eval/list] Inline schema ensure failed:", e);
    }

    const { rows: runs } = await query(
      `SELECT id, brain_id, status, total_queries,
              avg_mrr, avg_p3, avg_p5, avg_latency_ms,
              passed, failed, baseline_id,
              created_at::text, completed_at::text
       FROM eval_runs
       WHERE brain_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [auth.brainId]
    );

    return NextResponse.json({ runs });
  } catch (err) {
    console.error("[eval/list] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch eval runs", detail: String(err) },
      { status: 500 }
    );
  }
}
