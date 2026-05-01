/**
 * POST /api/eval/run — trigger eval run against captured candidates
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/auth-guard";
import {
  createEvalRun,
  completeEvalRun,
  failEvalRun,
  insertEvalResult,
  getEvalCandidates,
} from "@/lib/eval-pipeline";
import { searchBrain, expandQuery } from "@/lib/supabase/search";
import { generateEmbeddings } from "@/lib/embeddings";
import { vectorSearchBrain } from "@/lib/supabase/search";

export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { baseline_id?: string; limit?: number } = {};
  try { body = await req.json().catch(() => ({})); } catch { /* defaults */ }

  const queryLimit = Math.min(body.limit || 50, 500);
  const runId = await createEvalRun(auth.brainId, body.baseline_id);

  // Background processing
  runEvalInBackground(auth.brainId, runId, queryLimit).catch((err) => {
    console.error("[eval] Background eval failed:", err);
    failEvalRun(runId, err.message).catch(() => {});
  });

  return NextResponse.json({ run_id: runId, status: "running" });
}

async function runEvalInBackground(brainId: string, runId: string, limit: number) {
  const candidates = await getEvalCandidates(brainId, { limit, tool: "query" });
  if (candidates.length === 0) {
    await failEvalRun(runId, "No captured candidates to evaluate");
    return;
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

      await insertEvalResult(runId, {
        queryText: c.query_text, returnedSlugs: ret, expectedSlugs: exp,
        mrr, p3, p5, latencyMs: ms, passed: isPassed,
        rawMeta: { candidate_id: c.id },
      });

      totalMrr += mrr; totalP3 += p3; totalP5 += p5; totalLatency += ms;
      if (isPassed) passed++; else failed++;
    } catch (err: any) {
      console.error(`[eval] Query failed: ${c.query_text}`, err.message);
      failed++;
    }
  }

  const n = candidates.length;
  await completeEvalRun(runId, {
    totalQueries: n,
    avgMrr: n > 0 ? totalMrr / n : 0,
    avgP3: n > 0 ? totalP3 / n : 0,
    avgP5: n > 0 ? totalP5 / n : 0,
    avgLatencyMs: n > 0 ? Math.round(totalLatency / n) : 0,
    passed, failed,
  });
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
