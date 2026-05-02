import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";

// ── Queries (read-only, real-time) ──────────────────────────────

export const getBrainId = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
  },
});

export const listRuns = query({
  args: { brainId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("evalRuns")
      .withIndex("by_brain", (q) => q.eq("brainId", args.brainId))
      .order("desc")
      .take(20);
  },
});

export const listCandidates = query({
  args: { brainId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("evalCandidates")
      .withIndex("by_brain", (q) => q.eq("brainId", args.brainId))
      .order("desc")
      .take(100);
  },
});

// ── Mutations ───────────────────────────────────────────────────

export const seedAndRun = mutation({
  args: { brainId: v.string() },
  handler: async (ctx, args) => {
    // Check for existing candidates
    const existing = await ctx.db
      .query("evalCandidates")
      .withIndex("by_brain", (q) => q.eq("brainId", args.brainId))
      .take(1);

    // Seed if empty
    if (existing.length === 0) {
      const seedQueries = ["stripe", "yc", "hermes", "preetham"];
      for (const q of seedQueries) {
        await ctx.db.insert("evalCandidates", {
          brainId: args.brainId,
          tool: "search",
          queryText: q,
          resultCount: 0,
          topSlugs: [],
          meta: { seed: true },
        });
      }
    }

    // Create eval run
    const runId = await ctx.db.insert("evalRuns", {
      brainId: args.brainId,
      status: "running",
      totalQueries: 0,
      passed: 0,
      failed: 0,
    });

    // Kick off background processing via action (actions CAN use fetch!)
    await ctx.scheduler.runAfter(0, internal.eval.processRun, {
      runId,
      brainId: args.brainId,
    });

    return runId;
  },
});

// ── Internal mutations (called by the action for DB writes) ──────

export const saveResult = internalMutation({
  args: {
    runId: v.id("evalRuns"),
    queryText: v.string(),
    returnedSlugs: v.array(v.string()),
    expectedSlugs: v.array(v.string()),
    mrr: v.float64(),
    p3: v.float64(),
    p5: v.float64(),
    passed: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("evalResults", {
      runId: args.runId,
      queryText: args.queryText,
      returnedSlugs: args.returnedSlugs,
      expectedSlugs: args.expectedSlugs,
      mrr: args.mrr,
      p3: args.p3,
      p5: args.p5,
      latencyMs: 0,
      passed: args.passed,
    });

    // Update run counters
    const run = await ctx.db.get(args.runId);
    if (run) {
      await ctx.db.patch(args.runId, {
        totalQueries: run.totalQueries + 1,
        passed: args.passed ? run.passed + 1 : run.passed,
        failed: args.passed ? run.failed : run.failed + 1,
      });
    }
  },
});

export const failRun = internalMutation({
  args: {
    runId: v.id("evalRuns"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: "failed",
      meta: { error: args.error },
      completedAt: Date.now(),
    });
  },
});

export const finalizeRun = internalMutation({
  args: { runId: v.id("evalRuns") },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("evalResults")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .take(100);

    let totalMrr = 0, totalP3 = 0, totalP5 = 0;
    for (const r of results) {
      totalMrr += r.mrr;
      totalP3 += r.p3;
      totalP5 += r.p5;
    }
    const n = results.length || 1;
    await ctx.db.patch(args.runId, {
      status: "completed",
      avgMrr: totalMrr / n,
      avgP3: totalP3 / n,
      avgP5: totalP5 / n,
      avgLatencyMs: 0,
      completedAt: Date.now(),
    });
  },
});

// ── Internal: actual eval processing (ACTION — can use fetch!) ───

export const processRun = internalAction({
  args: {
    runId: v.id("evalRuns"),
    brainId: v.string(),
  },
  handler: async (ctx, args) => {
    // Read candidates
    const candidates = await ctx.runQuery(internal.eval.getCandidates, {
      brainId: args.brainId,
    });

    if (candidates.length === 0) {
      await ctx.runMutation(internal.eval.failRun, {
        runId: args.runId,
        error: "No candidates to evaluate",
      });
      return;
    }

    const candidate = candidates[0];
    const remaining = candidates.slice(1);

    try {
      const baseUrl = process.env.BRAINBASE_API_URL || "https://brainbase.belweave.ai";
      const evalSecret = process.env.CONVEX_EVAL_SECRET || "";

      // Call Brainbase query API
      const res = await fetch(`${baseUrl}/api/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Brain-Id": args.brainId,
          "X-Convex-Secret": evalSecret,
        },
        body: JSON.stringify({ q: candidate.queryText, limit: 10, detail: "medium" }),
      });

      if (!res.ok) {
        throw new Error(`Brainbase API error: ${res.status}`);
      }

      const data = await res.json();
      const retSlugs: string[] = (data.results || []).map((r: any) => r.slug);
      const expSlugs: string[] = (candidate.topSlugs as string[]) || [];

      // Compute metrics
      const mrr = computeMrr(retSlugs, expSlugs);
      const p3 = precisionAt(retSlugs, expSlugs, 3);
      const p5 = precisionAt(retSlugs, expSlugs, 5);
      const passed = p3 >= 0.3;

      await ctx.runMutation(internal.eval.saveResult, {
        runId: args.runId,
        queryText: candidate.queryText,
        returnedSlugs: retSlugs,
        expectedSlugs: expSlugs,
        mrr,
        p3,
        p5,
        passed,
      });

      // Process next or finalize
      if (remaining.length > 0) {
        await ctx.scheduler.runAfter(0, internal.eval.processRun, {
          runId: args.runId,
          brainId: args.brainId,
        });
      } else {
        await ctx.runMutation(internal.eval.finalizeRun, {
          runId: args.runId,
        });
      }
    } catch (err: any) {
      console.error("[eval] Candidate failed:", candidate.queryText, err.message);
      await ctx.runMutation(internal.eval.failRun, {
        runId: args.runId,
        error: `${candidate.queryText}: ${err.message}`,
      });
    }
  },
});

// Helper query for the action to read candidates
export const getCandidates = internalQuery({
  args: { brainId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("evalCandidates")
      .withIndex("by_brain", (q) => q.eq("brainId", args.brainId))
      .take(50);
  },
});

// ── Metric helpers ───────────────────────────────────────────────

function computeMrr(ret: string[], exp: string[]): number {
  for (let i = 0; i < ret.length; i++) {
    if (exp.includes(ret[i])) return 1 / (i + 1);
  }
  return 0;
}

function precisionAt(ret: string[], exp: string[], k: number): number {
  if (exp.length === 0) return 0;
  return ret.slice(0, k).filter((s) => exp.includes(s)).length / Math.min(k, exp.length);
}
