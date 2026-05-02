/**
 * GET /api/eval/export — export candidates as NDJSON
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
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 1000);
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
    } catch (e) {
      console.error("[eval/export] Inline schema ensure failed:", e);
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
      [...params, limit]
    );

    const lines = candidates.map((c: any) =>
      JSON.stringify({
        schema_version: 1,
        tool: c.tool,
        query_text: c.query_text,
        top_slugs: c.top_slugs,
        captured_at: c.created_at,
        meta: c.meta,
      })
    );

    return new NextResponse(lines.join("\n") + "\n", {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": `attachment; filename="eval-candidates-${new Date().toISOString().slice(0, 10)}.ndjson"`,
      },
    });
  } catch (err) {
    console.error("[eval/export] Error:", err);
    return NextResponse.json(
      { error: "Failed to export candidates", detail: String(err) },
      { status: 500 }
    );
  }
}
