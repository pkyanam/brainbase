/**
 * In-memory sliding-window rate limiter.
 *
 * Lives for the lifetime of a Node process (per Next.js server instance).
 * Resets on deploy. Acceptable for a soft DDoS / abuse limiter on
 * unauthenticated endpoints — not a hard quota.
 *
 * For per-user/per-brain quotas, see `usage.ts` (Postgres-backed).
 */

interface Window {
  count: number;
  resetAt: number; // epoch ms
}

const buckets = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check + increment a rate-limit bucket.
 *
 * @param key — bucket key (e.g. `ip:1.2.3.4`)
 * @param limit — max requests per window
 * @param windowMs — window length in ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let w = buckets.get(key);
  if (!w || now > w.resetAt) {
    w = { count: 0, resetAt: now + windowMs };
    buckets.set(key, w);
  }
  w.count += 1;
  const allowed = w.count <= limit;
  return { allowed, remaining: Math.max(0, limit - w.count), resetAt: w.resetAt };
}

/** Get the client IP from a Next.js request, with sensible header fallbacks. */
export function getClientIP(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
