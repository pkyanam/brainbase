/**
 * GET /api/billing/usage
 *
 * Returns current plan tier, usage stats, and limits for the authenticated brain.
 * Used by the dashboard to show plan status and upgrade prompts.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/auth-guard";
import { getBrainPlan, getUsage, PLAN_LIMITS } from "@/lib/usage";
import type { PlanTier } from "@/lib/usage";

export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await getBrainPlan(auth.brainId);
  const limits = PLAN_LIMITS[plan];

  const [pages, searches, apiCalls] = await Promise.all([
    getUsage(auth.brainId, "page_write"),
    getUsage(auth.brainId, "search"),
    getUsage(auth.brainId, "api_call"),
  ]);

  return NextResponse.json({
    plan,
    usage: {
      pages: { used: pages, limit: limits.pagesPerMonth },
      searches: { used: searches, limit: limits.searchesPerMonth },
      apiCalls: { used: apiCalls, limit: limits.apiCallsPerDay },
    },
    limits,
  });
}
