/**
 * GET /api/eval/tune
 *
 * Reads the latest eval run from Convex, analyzes MRR per query,
 * and suggests ranking weight adjustments to improve results.
 *
 * This closes the eval → rank feedback loop (P2 #4).
 * Weights are NOT auto-applied — the response shows suggestions
 * that can be applied manually or via an automated pipeline.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRankingConfig, setRankingConfig, type RankingConfig } from "@/lib/ranking-config";

// Convex deployment URL
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "";
const CONVEX_SECRET = process.env.CONVEX_EVAL_SECRET || "";

interface EvalRun {
  _id: string;
  brainId: string;
  status: string;
  avgMrr: number;
  avgP3: number;
  avgP5: number;
  totalQueries: number;
  passed: number;
  failed: number;
}

interface EvalResult {
  queryText: string;
  returnedSlugs: string[];
  expectedSlugs: string[];
  mrr: number;
  p3: number;
  p5: number;
  passed: boolean;
}

interface TuneSuggestion {
  parameter: string;
  current: number;
  suggested: number;
  reason: string;
}

export async function GET(req: NextRequest) {
  if (!CONVEX_URL) {
    return NextResponse.json({ error: "Convex not configured" }, { status: 500 });
  }

  try {
    // 1. Fetch latest completed eval run
    const runsRes = await fetch(`${CONVEX_URL}/api/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Convex ${CONVEX_SECRET}`,
      },
      body: JSON.stringify({
        path: "eval:listRuns",
        args: { brainId: "00000000-0000-0000-0000-000000000001" },
      }),
    });

    if (!runsRes.ok) {
      return NextResponse.json({ error: `Convex error: ${runsRes.status}` }, { status: 502 });
    }

    const runsData = await runsRes.json();
    const runs: EvalRun[] = runsData.value || [];

    // Find latest completed run
    const latestRun = runs.find((r) => r.status === "completed");
    if (!latestRun) {
      return NextResponse.json({
        status: "no_data",
        message: "No completed eval runs found. Run an eval first.",
      });
    }

    // 2. Calculate current baseline
    const currentMRR = latestRun.avgMrr || 0;
    const currentP3 = latestRun.avgP3 || 0;

    // 3. Get current config
    const config = getRankingConfig();

    // 4. Generate suggestions based on MRR analysis
    const suggestions: TuneSuggestion[] = [];

    // If MRR is low (< 0.5), backlinks might help
    if (currentMRR < 0.5) {
      suggestions.push({
        parameter: "backlinkCoef",
        current: config.backlinkCoef,
        suggested: Math.min(0.15, config.backlinkCoef * 2),
        reason: `MRR ${currentMRR.toFixed(3)} is low. Increasing backlink weight helps surface well-connected pages.`,
      });
    }

    // If P@3 is low, entity-type pages might need more boost
    if (currentP3 < 0.5) {
      const personBoost = config.sourceBoosts.person || 1.0;
      suggestions.push({
        parameter: "sourceBoosts.person",
        current: personBoost,
        suggested: Math.min(2.0, personBoost * 1.3),
        reason: `P@3 ${currentP3.toFixed(3)} is low. Person/entity pages may be buried.`,
      });

      const conceptBoost = config.sourceBoosts.concept || 1.0;
      suggestions.push({
        parameter: "sourceBoosts.concept",
        current: conceptBoost,
        suggested: Math.min(2.0, conceptBoost * 1.2),
        reason: `Increasing concept page visibility alongside person pages.`,
      });
    }

    // Backlink coef is generally useful
    if (config.backlinkCoef < 0.1) {
      suggestions.push({
        parameter: "backlinkCoef",
        current: config.backlinkCoef,
        suggested: 0.1,
        reason: "Backlink coefficient below 0.1. Higher values reward well-connected pages.",
      });
    }

    // 5. Build response
    return NextResponse.json({
      status: "ok",
      evalRun: {
        id: latestRun._id,
        mrr: currentMRR,
        p3: currentP3,
        p5: latestRun.avgP5,
        queries: latestRun.totalQueries,
        passed: latestRun.passed,
        failed: latestRun.failed,
      },
      currentConfig: {
        backlinkCoef: config.backlinkCoef,
        compiledTruthBoost: config.compiledTruthBoost,
        sourceBoosts: config.sourceBoosts,
      },
      suggestions,
      apply: suggestions.length > 0
        ? "POST to this endpoint with { apply: true } to apply suggested weights"
        : "No adjustments needed",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Eval tune failed", message: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body: { apply?: boolean; weights?: Partial<RankingConfig> } = {};
  try {
    body = await req.json();
  } catch {
    // No body
  }

  if (body.weights) {
    setRankingConfig(body.weights);
    const config = getRankingConfig();
    return NextResponse.json({
      status: "applied",
      config: {
        backlinkCoef: config.backlinkCoef,
        compiledTruthBoost: config.compiledTruthBoost,
        sourceBoosts: config.sourceBoosts,
      },
    });
  }

  if (body.apply) {
    // Run GET logic and auto-apply suggestions
    const getRes = await GET(req);
    const data = await getRes.json();

    if (data.suggestions && data.suggestions.length > 0) {
      const weights: Record<string, number> = {};
      for (const s of data.suggestions) {
        if (s.parameter === "backlinkCoef") {
          weights.backlinkCoef = s.suggested;
        }
        if (s.parameter.startsWith("sourceBoosts.")) {
          const key = s.parameter.replace("sourceBoosts.", "");
          if (!weights.sourceBoosts) (weights as any).sourceBoosts = {};
          (weights as any).sourceBoosts[key] = s.suggested;
        }
      }
      setRankingConfig(weights as any);
    }

    return NextResponse.json({
      status: "applied",
      applied: data.suggestions?.length || 0,
      config: getRankingConfig(),
    });
  }

  return NextResponse.json({
    status: "no_action",
    message: "Send { apply: true } to apply suggested weights, or { weights: {...} } for custom values.",
  });
}
