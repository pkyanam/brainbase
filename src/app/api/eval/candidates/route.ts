/**
 * GET /api/eval/candidates — list captured query candidates
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/auth-guard";
import { query } from "@/lib/supabase/client";

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const since = url.searchParams.get("since") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const tool = url.searchParams.get("tool") || undefined;

    // ── Force-create eval_candidates table inline ──
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS eval_candidates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          brain_id UUID NOT NULL,
          tool TEXT NOT NULL,
          query_text TEXT NOT NULL,
          result_count INTEGER,
          top_slugs TEXT[],
          meta JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await query(`ALTER TABLE eval_candidates ADD COLUMN IF NOT EXISTS tool TEXT`);
      await query(`CREATE INDEX IF NOT EXISTS idx_eval_candidates_brain_tool ON eval_candidates(brain_id, tool, created_at)`);
    } catch (e) {
      console.error("[eval/candidates] Inline schema ensure failed:", e);
    }

    const conditions: string[] = ["brain_id = $1"];
    const params: any[] = [auth.brainId];
    let paramIdx = 2;

    if (tool) {
      conditions.push(`tool = $${paramIdx++}`);
      params.push(tool);
    }
    if (since) {
      conditions.push(`created_at >= $${paramIdx++}`);
      params.push(since);
    }

    const { rows: candidates } = await query(
      `SELECT id, brain_id, tool, query_text, result_count, top_slugs, meta, created_at::text
       FROM eval_candidates
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT $${paramIdx}`,
      [...params, Math.min(limit, 1000)]
    );

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error("[eval/candidates] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch candidates", detail: String(err) },
      { status: 500 }
    );
  }
}
