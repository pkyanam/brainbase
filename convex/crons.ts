import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Convex Cron Jobs — replaces Vercel crons.
 *
 * - Daily at 06:00 UTC: full dream cycle across all brains
 * - Hourly: embed stale chunks for active brains
 * - Every 5 minutes: minion worker tick
 */

const crons = cronJobs();

export default crons;

// Daily dream cycle (06:00 UTC = midnight EST)
// ── Daily: run dream cycle across all brains ──
// @ts-ignore — types regenerate after `npx convex dev`
crons.interval("dream cycle", { hours: 24 }, internal.dream.discoverAndRunDreamCycle, {});

// ── Hourly: embed stale chunks ──
// @ts-ignore — types regenerate after `npx convex dev`
crons.interval("embed stale", { minutes: 60 }, internal.dream.discoverAndRunEmbed, {});

// ── Every 5 min: minion worker tick ──
// @ts-ignore — types regenerate after `npx convex dev`
crons.interval("worker tick", { minutes: 5 }, internal.jobs.workerTick, {});
