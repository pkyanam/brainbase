/**
 * Usage tracking and rate limiting for Brainbase.
 * Enforces per-brain quotas based on plan tier.
 */

import { queryOne, query } from "./supabase/client";

export type PlanTier = "free" | "pro" | "unlimited";

interface QuotaConfig {
  pagesPerMonth: number;
  searchesPerMonth: number;
  apiCallsPerDay: number;
  multiBrain: boolean;
  maxBrains: number;
}

const PLAN_LIMITS: Record<PlanTier, QuotaConfig> = {
  free: {
    pagesPerMonth: 100,
    searchesPerMonth: 500,
    apiCallsPerDay: 200,
    multiBrain: false,
    maxBrains: 1,
  },
  pro: {
    pagesPerMonth: 5000,
    searchesPerMonth: 20000,
    apiCallsPerDay: 2000,
    multiBrain: true,
    maxBrains: 10,
  },
  unlimited: {
    pagesPerMonth: Infinity,
    searchesPerMonth: Infinity,
    apiCallsPerDay: Infinity,
    multiBrain: true,
    maxBrains: Infinity,
  },
};

export async function ensureUsageSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS usage_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brain_id UUID NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      count INT NOT NULL DEFAULT 1,
      period TEXT NOT NULL DEFAULT 'daily',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_usage_logs_brain_action_period
    ON usage_logs(brain_id, action, period, created_at)
  `);

  // Add plan column to brains if not exists
  await query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brains') THEN
        ALTER TABLE brains ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
        ALTER TABLE brains ADD COLUMN IF NOT EXISTS page_quota INT DEFAULT 100;
        ALTER TABLE brains ADD COLUMN IF NOT EXISTS search_quota INT DEFAULT 500;
        ALTER TABLE brains ADD COLUMN IF NOT EXISTS api_quota INT DEFAULT 200;
      END IF;
    END $$;
  `);
}

/**
 * Get or default a brain's plan tier.
 */
export async function getBrainPlan(brainId: string): Promise<PlanTier> {
  await ensureUsageSchema();
  const row = await queryOne<{ plan: string }>(
    `SELECT plan FROM brains WHERE id = $1`,
    [brainId]
  );
  const plan = (row?.plan || "free") as PlanTier;
  return PLAN_LIMITS[plan] ? plan : "free";
}

/**
 * Record a usage event.
 */
export async function recordUsage(
  brainId: string,
  action: "page_write" | "search" | "api_call",
  count = 1
): Promise<void> {
  await ensureUsageSchema();
  const period = action === "api_call" ? "daily" : "monthly";
  await query(
    `INSERT INTO usage_logs (brain_id, action, count, period)
     VALUES ($1, $2, $3, $4)`,
    [brainId, action, count, period]
  );
}

/**
 * Get current usage for a brain in the current period.
 */
export async function getUsage(brainId: string, action: string): Promise<number> {
  await ensureUsageSchema();
  const period = action === "api_call" ? "daily" : "monthly";
  const timeFilter = action === "api_call"
    ? "created_at >= NOW() - INTERVAL '1 day'"
    : "created_at >= DATE_TRUNC('month', NOW())";

  const row = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(count), 0) as total
     FROM usage_logs
     WHERE brain_id = $1 AND action = $2 AND period = $3 AND ${timeFilter}`,
    [brainId, action, period]
  );
  return parseInt(row?.total || "0");
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

/**
 * Check if an action is within quota. Returns result + records usage if allowed.
 */
export async function checkRateLimit(
  brainId: string,
  action: "page_write" | "search" | "api_call",
  count = 1
): Promise<RateLimitResult> {
  const plan = await getBrainPlan(brainId);
  const config = PLAN_LIMITS[plan];

  let limit: number;
  switch (action) {
    case "page_write": limit = config.pagesPerMonth; break;
    case "search": limit = config.searchesPerMonth; break;
    case "api_call": limit = config.apiCallsPerDay; break;
    default: limit = Infinity;
  }

  const current = await getUsage(brainId, action);
  const remaining = Math.max(0, limit - current);
  const allowed = current + count <= limit || limit === Infinity;

  const resetAt = action === "api_call"
    ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString();

  if (allowed) {
    await recordUsage(brainId, action, count);
  }

  return { allowed, current, limit, remaining, resetAt };
}

/**
 * Middleware-style helper for API routes.
 * Returns null if allowed, or a Response object if blocked.
 */
export async function requireQuota(
  brainId: string,
  action: "page_write" | "search" | "api_call",
  count = 1
): Promise<null | Response> {
  const result = await checkRateLimit(brainId, action, count);
  if (result.allowed) return null;

  return new Response(
    JSON.stringify({
      error: `Rate limit exceeded for ${action}. Limit: ${result.limit}/${action === "api_call" ? "day" : "month"}. Resets at ${result.resetAt}`,
      limit: result.limit,
      current: result.current,
      remaining: result.remaining,
      reset_at: result.resetAt,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": result.resetAt,
      },
    }
  );
}
