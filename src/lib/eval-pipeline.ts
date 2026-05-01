/**
 * Eval pipeline: capture, export, replay (BrainBench-Real)
 *
 * Schema:
 * - eval_candidates: raw captured queries
 * - eval_runs: batch eval runs (baseline vs current)
 * - eval_results: per-query metrics for each run
 */

import { query, queryOne, queryMany } from "./supabase/client";

// ── Schema ──────────────────────────────────────────────────────────

export async function ensureEvalSchema(): Promise<void> {
  // Idempotent column additions for tables that may exist from older deploys
  // (wrap in try/catch — tables won't exist on very first deploy, which is fine)
  try { await query(`ALTER TABLE eval_candidates ADD COLUMN IF NOT EXISTS brain_id UUID`); } catch {}
  try { await query(`ALTER TABLE eval_runs ADD COLUMN IF NOT EXISTS brain_id UUID`); } catch {}
  try { await query(`ALTER TABLE eval_capture_failures ADD COLUMN IF NOT EXISTS brain_id UUID`); } catch {}

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

  await query(`
    CREATE INDEX IF NOT EXISTS idx_eval_candidates_brain_tool
    ON eval_candidates(brain_id, tool, created_at)
  `);

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
      baseline_id UUID REFERENCES eval_runs(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_eval_runs_brain
    ON eval_runs(brain_id, created_at DESC)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS eval_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
      query_text TEXT NOT NULL,
      returned_slugs TEXT[],
      expected_slugs TEXT[],
      mrr DOUBLE PRECISION,
      p3 DOUBLE PRECISION,
      p5 DOUBLE PRECISION,
      latency_ms DOUBLE PRECISION,
      passed BOOLEAN,
      raw_meta JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_eval_results_run
    ON eval_results(run_id, passed)
  `);

  // Capture failures audit trail
  await query(`
    CREATE TABLE IF NOT EXISTS eval_capture_failures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brain_id UUID NOT NULL,
      tool TEXT,
      query_text TEXT,
      reason TEXT NOT NULL,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ── Capture ─────────────────────────────────────────────────────────

export interface EvalCandidateInput {
  brainId: string;
  tool: "query" | "search";
  queryText: string;
  resultCount: number;
  topSlugs: string[];
  meta?: Record<string, unknown>;
}

export async function captureEvalCandidate(input: EvalCandidateInput): Promise<void> {
  try {
    await ensureEvalSchema();
    await query(
      `INSERT INTO eval_candidates (brain_id, tool, query_text, result_count, top_slugs, meta)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [
        input.brainId,
        input.tool,
        input.queryText,
        input.resultCount,
        input.topSlugs,
        JSON.stringify(input.meta || {}),
      ]
    );
  } catch (err: any) {
    console.error("[eval] Capture failed:", err.message);
    // Fire-and-forget failure audit
    try {
      await query(
        `INSERT INTO eval_capture_failures (brain_id, tool, query_text, reason, error_message)
         VALUES ($1, $2, $3, 'capture_error', $4)`,
        [input.brainId, input.tool, input.queryText, err.message?.slice(0, 500)]
      );
    } catch {
      // can't even log the failure
    }
  }
}

// ── Export ──────────────────────────────────────────────────────────

export interface EvalCandidateRow {
  id: string;
  brain_id: string;
  tool: string;
  query_text: string;
  result_count: number;
  top_slugs: string[];
  meta: Record<string, unknown>;
  created_at: string;
}

export async function getEvalCandidates(
  brainId: string,
  opts: { since?: string; limit?: number; tool?: string } = {}
): Promise<EvalCandidateRow[]> {
  await ensureEvalSchema();
  const conditions: string[] = ["brain_id = $1"];
  const params: any[] = [brainId];
  let paramIdx = 2;

  if (opts.tool) {
    conditions.push(`tool = $${paramIdx++}`);
    params.push(opts.tool);
  }
  if (opts.since) {
    conditions.push(`created_at >= $${paramIdx++}`);
    params.push(opts.since);
  }

  const limit = Math.min(opts.limit || 100, 1000);
  return queryMany<EvalCandidateRow>(
    `SELECT id, brain_id, tool, query_text, result_count, top_slugs, meta, created_at::text
     FROM eval_candidates
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${paramIdx}`,
    [...params, limit]
  );
}

// ── Run Management ──────────────────────────────────────────────────

export interface EvalRunRow {
  id: string;
  brain_id: string;
  status: string;
  total_queries: number;
  avg_mrr: number | null;
  avg_p3: number | null;
  avg_p5: number | null;
  avg_latency_ms: number | null;
  passed: number;
  failed: number;
  baseline_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export async function createEvalRun(
  brainId: string,
  baselineId?: string
): Promise<string> {
  await ensureEvalSchema();
  const row = await queryOne<{ id: string }>(
    `INSERT INTO eval_runs (brain_id, status, baseline_id)
     VALUES ($1, 'running', $2)
     RETURNING id`,
    [brainId, baselineId || null]
  );
  return row!.id;
}

export async function completeEvalRun(
  runId: string,
  stats: {
    totalQueries: number;
    avgMrr: number;
    avgP3: number;
    avgP5: number;
    avgLatencyMs: number;
    passed: number;
    failed: number;
  }
): Promise<void> {
  await query(
    `UPDATE eval_runs
     SET status = 'completed',
         total_queries = $1,
         avg_mrr = $2,
         avg_p3 = $3,
         avg_p5 = $4,
         avg_latency_ms = $5,
         passed = $6,
         failed = $7,
         completed_at = NOW()
     WHERE id = $8`,
    [
      stats.totalQueries,
      stats.avgMrr,
      stats.avgP3,
      stats.avgP5,
      stats.avgLatencyMs,
      stats.passed,
      stats.failed,
      runId,
    ]
  );
}

export async function failEvalRun(runId: string, error: string): Promise<void> {
  await query(
    `UPDATE eval_runs
     SET status = 'failed',
         meta = jsonb_set(COALESCE(meta, '{}'), '{error}', $2::jsonb),
         completed_at = NOW()
     WHERE id = $1`,
    [runId, JSON.stringify(error)]
  );
}

export async function getEvalRuns(
  brainId: string,
  limit = 20
): Promise<EvalRunRow[]> {
  await ensureEvalSchema();
  return queryMany<EvalRunRow>(
    `SELECT id, brain_id, status, total_queries,
            avg_mrr, avg_p3, avg_p5, avg_latency_ms,
            passed, failed, baseline_id,
            created_at::text, completed_at::text
     FROM eval_runs
     WHERE brain_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [brainId, limit]
  );
}

// ── Results ─────────────────────────────────────────────────────────

export interface EvalResultRow {
  id: string;
  run_id: string;
  query_text: string;
  returned_slugs: string[];
  expected_slugs: string[];
  mrr: number;
  p3: number;
  p5: number;
  latency_ms: number;
  passed: boolean;
  raw_meta: Record<string, unknown> | null;
  created_at: string;
}

export async function insertEvalResult(
  runId: string,
  result: {
    queryText: string;
    returnedSlugs: string[];
    expectedSlugs: string[];
    mrr: number;
    p3: number;
    p5: number;
    latencyMs: number;
    passed: boolean;
    rawMeta?: Record<string, unknown>;
  }
): Promise<void> {
  await query(
    `INSERT INTO eval_results (run_id, query_text, returned_slugs, expected_slugs,
       mrr, p3, p5, latency_ms, passed, raw_meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      runId,
      result.queryText,
      result.returnedSlugs,
      result.expectedSlugs,
      result.mrr,
      result.p3,
      result.p5,
      result.latencyMs,
      result.passed,
      JSON.stringify(result.rawMeta || {}),
    ]
  );
}

export async function getEvalResults(
  runId: string,
  limit = 100
): Promise<EvalResultRow[]> {
  return queryMany<EvalResultRow>(
    `SELECT id, run_id, query_text, returned_slugs, expected_slugs,
            mrr, p3, p5, latency_ms, passed, raw_meta, created_at::text
     FROM eval_results
     WHERE run_id = $1
     ORDER BY mrr ASC
     LIMIT $2`,
    [runId, limit]
  );
}
