/**
 * POST /api/eval/run — trigger eval run against captured candidates
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/auth-guard";
import { query, queryOne, queryMany } from "@/lib/supabase/client";
import { searchBrain, expandQuery } from "@/lib/supabase/search";
import { generateEmbeddings } from "@/lib/embeddings";
import { vectorSearchBrain } from "@/lib/supabase/search";

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { baseline_id?: string; limit?: number } = {};
    try { body = await req.json().catch(() => ({})); } catch { /* defaults */ }

    // ── Ensure eval tables exist ──
    try {
      await query(`CREATE TABLE IF NOT EXISTS eval_candidates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brain_id UUID NOT NULL, tool TEXT NOT NULL,
        query_text TEXT NOT NULL, result_count INTEGER,
        top_slugs TEXT[], meta JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS eval_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brain_id UUID NOT NULL, status TEXT NOT NULL DEFAULT 'running',
        total_queries INTEGER DEFAULT 0, avg_mrr DOUBLE PRECISION,
        avg_p3 DOUBLE PRECISION, avg_p5 DOUBLE PRECISION,
        avg_latency_ms DOUBLE PRECISION, passed INTEGER DEFAULT 0,
        failed INTEGER DEFAULT 0, baseline_id UUID, meta JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ
      )`);
      await query(`CREATE TABLE IF NOT EXISTS eval_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL, query_text TEXT NOT NULL,
        returned_slugs TEXT[], expected_slugs TEXT[],
        mrr DOUBLE PRECISION, p3 DOUBLE PRECISION,
        p5 DOUBLE PRECISION, latency_ms DOUBLE PRECISION,
        passed BOOLEAN, raw_meta JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS eval_capture_failures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brain_id UUID NOT NULL, tool TEXT, query_text TEXT,
        reason TEXT NOT NULL, error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`);
    } catch (e) {
      console.error("[eval/run] Inline schema ensure failed:", e);
    }

    const queryLimit = Math.min(body.limit || 50, 500);

    // Create the run
    const runRow = await queryOne<{ id: string }>(
      `INSERT INTO eval_runs (brain_id, status, baseline_id)
       VALUES ($1, 'running', $2) RETURNING id`,
      [auth.brainId, body.baseline_id || null]
    );
    const runId = runRow!.id;

    // Process synchronously (Vercel Hobby kills background promises after response)
    try {
      await runEvalCycle(auth.brainId, runId, queryLimit);
    } catch (err: any) {
      console.error("[eval] Eval cycle failed:", err);
      await query(
        `UPDATE eval_runs SET status = 'failed',
         meta = jsonb_set(COALESCE(meta, '{}'), '{error}', to_jsonb($2::text)),
         completed_at = NOW() WHERE id = $1`,
        [runId, String(err.message).slice(0, 1000)]
      ).catch(() => {});
    }

    return NextResponse.json({ run_id: runId, status: "running" });
  } catch (err) {
    console.error("[eval/run] Error:", err);
    return NextResponse.json(
      { error: "Failed to start eval run", detail: String(err) },
      { status: 500 }
    );
  }
}

async function runEvalCycle(brainId: string, runId: string, limit: number) {
  // Get candidates
  let { rows: candidates } = await query<any>(
    `SELECT id, brain_id, tool, query_text, result_count, top_slugs, meta
     FROM eval_candidates
     WHERE brain_id = $1 AND (tool = 'query' OR tool = 'search')
     ORDER BY created_at DESC LIMIT $2`,
    [brainId, limit]
  );

  if (candidates.length === 0) {
    // Seed synthetic candidates directly (no searchBrain — that could timeout on Vercel Hobby)
    const seedQueries = ["stripe", "yc", "hermes", "preetham"];
    for (const sq of seedQueries) {
      await query(
        `INSERT INTO eval_candidates (brain_id, tool, query_text, result_count, top_slugs, meta)
         VALUES ($1, 'search', $2, 0, $3, $4)`,
        [brainId, sq, [], JSON.stringify({ seed: true })]
      );
    }

    // Re-read
    const { rows: seeded } = await query<any>(
      `SELECT id, brain_id, tool, query_text, result_count, top_slugs, meta
       FROM eval_candidates
       WHERE brain_id = $1 AND (tool = 'query' OR tool = 'search')
       ORDER BY created_at DESC LIMIT $2`,
      [brainId, limit]
    );
    if (seeded.length === 0) {
      await query(`UPDATE eval_runs SET status = 'failed', completed_at = NOW() WHERE id = $1`, [runId]);
      return;
    }
    candidates = seeded;
  }

  let totalMrr = 0, totalP3 = 0, totalP5 = 0, totalLatency = 0;
  let passed = 0, failed = 0;

  for (const c of candidates) {
    const t0 = Date.now();
    try {
      const expandedQ = expandQuery(c.query_text);
      const kwLimit = 40;
      const [kw, emb] = await Promise.all([
        searchBrain(brainId, c.query_text, kwLimit),
        generateEmbeddings([expandedQ]).then((e) => e?.[0] ?? null),
      ]);
      let vec: any[] = [];
      if (emb) vec = await vectorSearchBrain(brainId, emb, kwLimit);

      const slugs = new Set<string>();
      for (const r of kw) slugs.add(r.slug);
      for (const r of vec) slugs.add(r.slug);
      const ret = Array.from(slugs).slice(0, 10);
      const exp = c.top_slugs || [];

      const { mrr, p3, p5 } = computeMetrics(ret, exp);
      const ms = Date.now() - t0;
      const isPassed = p3 >= 0.3;

      await query(
        `INSERT INTO eval_results (run_id, query_text, returned_slugs, expected_slugs,
           mrr, p3, p5, latency_ms, passed, raw_meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [runId, c.query_text, ret, exp, mrr, p3, p5, ms, isPassed, JSON.stringify({ candidate_id: c.id })]
      );

      totalMrr += mrr; totalP3 += p3; totalP5 += p5; totalLatency += ms;
      if (isPassed) passed++; else failed++;
    } catch (err: any) {
      console.error(`[eval] Query failed: ${c.query_text}`, err.message);
      failed++;
    }
  }

  const n = candidates.length;
  await query(
    `UPDATE eval_runs
     SET status = 'completed', total_queries = $1, avg_mrr = $2, avg_p3 = $3,
         avg_p5 = $4, avg_latency_ms = $5, passed = $6, failed = $7, completed_at = NOW()
     WHERE id = $8`,
    [n, n > 0 ? totalMrr / n : 0, n > 0 ? totalP3 / n : 0, n > 0 ? totalP5 / n : 0,
     n > 0 ? Math.round(totalLatency / n) : 0, passed, failed, runId]
  );
}

function computeMetrics(ret: string[], exp: string[]) {
  if (exp.length === 0) return { mrr: 0, p3: 0, p5: 0 };
  let mrr = 0;
  for (let i = 0; i < ret.length; i++) {
    if (exp.includes(ret[i])) { mrr = 1 / (i + 1); break; }
  }
  const p3 = ret.slice(0, 3).filter(s => exp.includes(s)).length / Math.min(3, exp.length);
  const p5 = ret.slice(0, 5).filter(s => exp.includes(s)).length / Math.min(5, exp.length);
  return { mrr: Math.round(mrr * 1000) / 1000, p3: Math.round(p3 * 1000) / 1000, p5: Math.round(p5 * 1000) / 1000 };
}
