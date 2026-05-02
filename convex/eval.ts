import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./_generated/server";
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

    // Kick off background processing via action
    await ctx.scheduler.runAfter(0, internal.eval.processRun, {
      runId,
      brainId: args.brainId,
    });

    return runId;
  },
});

// ── Internal: actual eval processing ─────────────────────────────

export const processRun = internalMutation({
  args: {
    runId: v.id("evalRuns"),
    brainId: v.string(),
  },
  handler: async (ctx, args) => {
    // Read candidates
    const candidates = await ctx.db
      .query("evalCandidates")
      .withIndex("by_brain", (q) => q.eq("brainId", args.brainId))
      .take(50);

    if (candidates.length === 0) {
      await ctx.db.patch(args.runId, {
        status: "failed",
        meta: { error: "No candidates to evaluate" },
        completedAt: Date.now(),
      });
      return;
    }

    // For each candidate, query the brainbase search API
    // Convex mutations are transactions — limited to 16KB writes.
    // We process one candidate per mutation invocation to stay within limits.
    const candidate = candidates[0]; // process first candidate

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
      const expSlugs: string[] = candidate.topSlugs || [];

      // Compute metrics
      const mrr = computeMrr(retSlugs, expSlugs);
      const p3 = precisionAt(retSlugs, expSlugs, 3);
      const p5 = precisionAt(retSlugs, expSlugs, 5);
      const passed = p3 >= 0.3;

      await ctx.db.insert("evalResults", {
        runId: args.runId,
        queryText: candidate.queryText,
        returnedSlugs: retSlugs,
        expectedSlugs: expSlugs,
        mrr,
        p3,
        p5,
        latencyMs: 0, // will update if we track latency
        passed,
      });

      // Update run stats
      const run = await ctx.db.get(args.runId);
      if (run) {
        await ctx.db.patch(args.runId, {
          totalQueries: run.totalQueries + 1,
          passed: passed ? run.passed + 1 : run.passed,
          failed: passed ? run.failed : run.failed + 1,
        });
      }

      // Schedule processing of next candidate
      const remaining = candidates.slice(1);
      if (remaining.length > 0) {
        await ctx.scheduler.runAfter(0, internal.eval.processRun, {
          runId: args.runId,
          brainId: args.brainId,
        });
      } else {
        // All done — finalize
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
        const n = results.length;
        await ctx.db.patch(args.runId, {
          status: "completed",
          avgMrr: n > 0 ? totalMrr / n : 0,
          avgP3: n > 0 ? totalP3 / n : 0,
          avgP5: n > 0 ? totalP5 / n : 0,
          avgLatencyMs: 0,
          completedAt: Date.now(),
        });
      }
    } catch (err: any) {
      console.error("[eval] Candidate failed:", candidate.queryText, err.message);
      // Mark run as failed and continue
      await ctx.db.patch(args.runId, {
        status: "failed",
        meta: { error: err.message },
        completedAt: Date.now(),
      });
    }
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
