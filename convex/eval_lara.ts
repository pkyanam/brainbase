import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// ═══════════════════════════════════════════════════════════════════
// Lara Eval Dataset — 139 queries with verified ground truth
// Completely separate from Arlan's eval. Does NOT clear his candidates.
// ═══════════════════════════════════════════════════════════════════

// ── Queries (read-only, real-time) ──────────────────────────────

export const listRuns = query({
  args: { brainId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("laraEvalRuns")
      .withIndex("by_brain", (q) => q.eq("brainId", args.brainId))
      .order("desc")
      .take(20);
  },
});

export const listCandidates = query({
  args: { brainId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("laraEvalCandidates")
      .withIndex("by_brain", (q) => q.eq("brainId", args.brainId))
      .order("desc")
      .take(200);
  },
});

export const getResults = query({
  args: { runId: v.id("laraEvalRuns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("laraEvalResults")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(200);
  },
});

// ── Seed Mutation (NON-DESTRUCTIVE — adds without clearing) ─────

export const seedLaraEval = mutation({
  args: { brainId: v.string() },
  handler: async (ctx, args) => {
    // Count existing to avoid dupes on re-seed
    const existing = await ctx.db
      .query("laraEvalCandidates")
      .withIndex("by_brain", (q) => q.eq("brainId", args.brainId))
      .take(1);

    if (existing.length > 0) {
      return { seeded: false, reason: "Already seeded. Use clearLaraEval then re-seed if needed." };
    }

    for (const item of LARA_EVAL_DATASET) {
      await ctx.db.insert("laraEvalCandidates", {
        brainId: args.brainId,
        tool: "search",
        queryText: item.query,
        resultCount: 0,
        topSlugs: item.topSlugs,
        category: item.category,
        meta: { source: "lara", category: item.category },
      });
    }

    return { seeded: true, count: LARA_EVAL_DATASET.length };
  },
});

export const clearLaraEval = mutation({
  args: { brainId: v.string() },
  handler: async (ctx, args) => {
    const candidates = await ctx.db
      .query("laraEvalCandidates")
      .withIndex("by_brain", (q) => q.eq("brainId", args.brainId))
      .take(200);
    for (const c of candidates) await ctx.db.delete(c._id);

    const runs = await ctx.db
      .query("laraEvalRuns")
      .withIndex("by_brain", (q) => q.eq("brainId", args.brainId))
      .take(50);
    for (const r of runs) await ctx.db.delete(r._id);

    return { cleared: true, candidatesDeleted: candidates.length, runsDeleted: runs.length };
  },
});

// ── Run Mutation ────────────────────────────────────────────────

export const runLaraEval = mutation({
  args: { brainId: v.string(), baselineId: v.optional(v.id("laraEvalRuns")) },
  handler: async (ctx, args) => {
    const runId = await ctx.db.insert("laraEvalRuns", {
      brainId: args.brainId,
      status: "running",
      totalQueries: 0,
      passed: 0,
      failed: 0,
      baselineId: args.baselineId,
    });

    await ctx.scheduler.runAfter(0, internal.eval_lara.processRun, {
      runId,
      brainId: args.brainId,
    });

    return runId;
  },
});

// ── Internal mutations ──────────────────────────────────────────

export const saveResult = internalMutation({
  args: {
    runId: v.id("laraEvalRuns"),
    queryText: v.string(),
    returnedSlugs: v.array(v.string()),
    expectedSlugs: v.array(v.string()),
    mrr: v.float64(),
    p3: v.float64(),
    p5: v.float64(),
    passed: v.boolean(),
    latencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("laraEvalResults", {
      runId: args.runId,
      queryText: args.queryText,
      returnedSlugs: args.returnedSlugs,
      expectedSlugs: args.expectedSlugs,
      mrr: args.mrr,
      p3: args.p3,
      p5: args.p5,
      latencyMs: args.latencyMs,
      passed: args.passed,
    });

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
  args: { runId: v.id("laraEvalRuns"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, { status: "failed", meta: { error: args.error }, completedAt: Date.now() });
  },
});

export const finalizeRun = internalMutation({
  args: { runId: v.id("laraEvalRuns") },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("laraEvalResults")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .take(200);

    let totalMrr = 0, totalP3 = 0, totalP5 = 0, totalLatency = 0;
    for (const r of results) {
      totalMrr += r.mrr;
      totalP3 += r.p3;
      totalP5 += r.p5;
      totalLatency += r.latencyMs;
    }
    const n = results.length || 1;
    await ctx.db.patch(args.runId, {
      status: "completed",
      avgMrr: totalMrr / n,
      avgP3: totalP3 / n,
      avgP5: totalP5 / n,
      avgLatencyMs: Math.round(totalLatency / n),
      completedAt: Date.now(),
    });
  },
});

// ── Internal Action: eval processing ─────────────────────────────

export const processRun = internalAction({
  args: {
    runId: v.id("laraEvalRuns"),
    brainId: v.string(),
    index: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const idx = args.index ?? 0;
    const candidates = await ctx.runQuery(internal.eval_lara.getCandidates, { brainId: args.brainId });

    if (candidates.length === 0) {
      await ctx.runMutation(internal.eval_lara.failRun, { runId: args.runId, error: "No Lara candidates" });
      return;
    }
    if (idx >= candidates.length) {
      await ctx.runMutation(internal.eval_lara.finalizeRun, { runId: args.runId });
      return;
    }

    const candidate = candidates[idx];
    try {
      const baseUrl = process.env.BRAINBASE_API_URL || "https://brainbase.belweave.ai";
      const evalSecret = process.env.CONVEX_EVAL_SECRET || "";

      console.log(`[lara-eval] ${idx + 1}/${candidates.length}: ${candidate.queryText}`);
      const t0 = Date.now();

      const res = await fetch(`${baseUrl}/api/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Brain-Id": args.brainId,
          "X-Convex-Secret": evalSecret,
        },
        body: JSON.stringify({ q: candidate.queryText, limit: 10, detail: "medium" }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);

      const data = await res.json();
      const retSlugs: string[] = (data.results || []).map((r: any) => r.slug);
      const expSlugs: string[] = candidate.topSlugs || [];
      const ms = Date.now() - t0;

      const mrr = computeMrr(retSlugs, expSlugs);
      const p3 = precisionAt(retSlugs, expSlugs, 3);
      const p5 = precisionAt(retSlugs, expSlugs, 5);
      const passed = p3 >= 0.3;

      await ctx.runMutation(internal.eval_lara.saveResult, {
        runId: args.runId,
        queryText: candidate.queryText,
        returnedSlugs: retSlugs,
        expectedSlugs: expSlugs,
        mrr,
        p3,
        p5,
        passed,
        latencyMs: ms,
      });

      await ctx.scheduler.runAfter(0, internal.eval_lara.processRun, {
        runId: args.runId,
        brainId: args.brainId,
        index: idx + 1,
      });
    } catch (err: any) {
      console.error("[lara-eval] Failed:", candidate.queryText, err.message);
      await ctx.runMutation(internal.eval_lara.failRun, {
        runId: args.runId,
        error: `${candidate.queryText}: ${err.message}`,
      });
    }
  },
});

export const getCandidates = internalQuery({
  args: { brainId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("laraEvalCandidates")
      .withIndex("by_brain", (q) => q.eq("brainId", args.brainId))
      .take(200);
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

// ═══════════════════════════════════════════════════════════════════
// DATASET: 139 queries across 16 categories
// Ground truth verified against actual brain content (May 2026)
// ═══════════════════════════════════════════════════════════════════

interface EvalItem {
  query: string;
  topSlugs: string[];
  category: string;
}

const LARA_EVAL_DATASET: EvalItem[] = [
  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 1: Entity — exact match (bare name)
  // ═══════════════════════════════════════════════════════════════
  { query: "Preetham Kyanam", topSlugs: ["people/preetham-kyanam"], category: "entity_exact" },
  { query: "Garry Tan", topSlugs: ["people/garry-tan"], category: "entity_exact" },
  { query: "Meghna Kyanam", topSlugs: ["meghna-kyanam"], category: "entity_exact" },
  { query: "Julian Styles", topSlugs: ["julian-styles"], category: "entity_exact" },
  { query: "Anmol Das", topSlugs: ["anmol-das"], category: "entity_exact" },
  { query: "Sally McKee", topSlugs: ["people/sally-mckee"], category: "entity_exact" },
  { query: "Shivam Parikh", topSlugs: ["shivam-parikh"], category: "entity_exact" },
  { query: "Pranathi Divi", topSlugs: ["pranathi-divi"], category: "entity_exact" },
  { query: "Jared Cooper", topSlugs: ["jared-cooper"], category: "entity_exact" },
  { query: "Jonbitch Corpuzzy", topSlugs: ["jonbitch-jr-corpuzzy"], category: "entity_exact" },
  { query: "Nick Cooper", topSlugs: ["nick-cooper"], category: "entity_exact" },
  { query: "Austin Johnson", topSlugs: ["austin-johnson"], category: "entity_exact" },
  { query: "Zach Silvasy", topSlugs: ["zach-silvasy"], category: "entity_exact" },
  { query: "Gokul Divi", topSlugs: ["gokul-divi"], category: "entity_exact" },
  { query: "Malik Elemam", topSlugs: ["malik-elemam"], category: "entity_exact" },
  { query: "Manvitha Kacherla", topSlugs: ["manvitha-kacherla"], category: "entity_exact" },
  { query: "Erin Amiss", topSlugs: ["erin-amiss"], category: "entity_exact" },
  { query: "Ethan Jones", topSlugs: ["ethan-jones"], category: "entity_exact" },
  { query: "Thomas Lowery", topSlugs: ["thomas-lowery"], category: "entity_exact" },
  { query: "Nitesh Manem", topSlugs: ["nitesh-manem"], category: "entity_exact" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 2: Entity — "who is" pattern
  // ═══════════════════════════════════════════════════════════════
  { query: "who is Preetham Kyanam", topSlugs: ["people/preetham-kyanam"], category: "entity_whois" },
  { query: "who is Garry Tan", topSlugs: ["people/garry-tan"], category: "entity_whois" },
  { query: "who is Meghna", topSlugs: ["meghna-kyanam"], category: "entity_whois" },
  { query: "who is Julian Styles", topSlugs: ["julian-styles"], category: "entity_whois" },
  { query: "who is Sally McKee", topSlugs: ["people/sally-mckee"], category: "entity_whois" },
  { query: "who is Shivam Parikh", topSlugs: ["shivam-parikh"], category: "entity_whois" },
  { query: "who is Anmol Das", topSlugs: ["anmol-das"], category: "entity_whois" },
  { query: "who is Pranathi Divi", topSlugs: ["pranathi-divi"], category: "entity_whois" },
  { query: "who is Jared Cooper", topSlugs: ["jared-cooper"], category: "entity_whois" },
  { query: "who is Nick Cooper", topSlugs: ["nick-cooper"], category: "entity_whois" },
  { query: "who is Zach Silvasy", topSlugs: ["zach-silvasy"], category: "entity_whois" },
  { query: "who is Gokul Divi", topSlugs: ["gokul-divi"], category: "entity_whois" },
  { query: "who is Erin Amiss", topSlugs: ["erin-amiss"], category: "entity_whois" },
  { query: "who is Thomas Lowery", topSlugs: ["thomas-lowery"], category: "entity_whois" },
  { query: "who is Nitesh Manem", topSlugs: ["nitesh-manem"], category: "entity_whois" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 3: Entity — "tell me about" pattern
  // ═══════════════════════════════════════════════════════════════
  { query: "tell me about Preetham", topSlugs: ["people/preetham-kyanam"], category: "entity_tellme" },
  { query: "tell me about Garry Tan", topSlugs: ["people/garry-tan"], category: "entity_tellme" },
  { query: "tell me about Meghna Kyanam", topSlugs: ["meghna-kyanam"], category: "entity_tellme" },
  { query: "tell me about Julian", topSlugs: ["julian-styles"], category: "entity_tellme" },
  { query: "tell me about Anmol", topSlugs: ["anmol-das"], category: "entity_tellme" },
  { query: "tell me about Sally McKee", topSlugs: ["people/sally-mckee"], category: "entity_tellme" },
  { query: "tell me about Shivam", topSlugs: ["shivam-parikh"], category: "entity_tellme" },
  { query: "tell me about Pranathi Divi", topSlugs: ["pranathi-divi"], category: "entity_tellme" },
  { query: "tell me about Jared Cooper", topSlugs: ["jared-cooper"], category: "entity_tellme" },
  { query: "tell me about Nick Cooper", topSlugs: ["nick-cooper"], category: "entity_tellme" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 4: Company / Organization
  // ═══════════════════════════════════════════════════════════════
  { query: "Apple", topSlugs: ["companies/apple"], category: "company" },
  { query: "Y Combinator", topSlugs: ["companies/yc"], category: "company" },
  { query: "OpenAI", topSlugs: ["companies/openai"], category: "company" },
  { query: "DeepSeek", topSlugs: ["companies/deepseek"], category: "company" },
  { query: "Vercel", topSlugs: ["companies/vercel"], category: "company" },
  { query: "Cloudflare", topSlugs: ["companies/cloudflare"], category: "company" },
  { query: "Cursor", topSlugs: ["companies/cursor"], category: "company" },
  { query: "Nvidia", topSlugs: ["companies/nvidia"], category: "company" },
  { query: "University of Virginia", topSlugs: ["university-of-virginia"], category: "company" },
  { query: "Rutgers University", topSlugs: ["rutgers-university"], category: "company" },
  { query: "npm", topSlugs: ["companies/npm"], category: "company" },
  { query: "Netlify", topSlugs: ["companies/netlify"], category: "company" },
  { query: "Epic Games", topSlugs: ["companies/epic-games"], category: "company" },
  { query: "Adobe", topSlugs: ["companies/adobe"], category: "company" },
  { query: "Micron Technology", topSlugs: ["companies/micron"], category: "company" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 5: Project / Software
  // ═══════════════════════════════════════════════════════════════
  { query: "brainbase", topSlugs: ["projects/brainbase"], category: "project" },
  { query: "Brainbase", topSlugs: ["projects/brainbase"], category: "project" },
  { query: "Hermes Agent", topSlugs: ["software/hermes-agent"], category: "project" },
  { query: "hermes", topSlugs: ["software/hermes-agent"], category: "project" },
  { query: "Radicle", topSlugs: ["projects/radicle"], category: "project" },
  { query: "Ghostty", topSlugs: ["projects/ghostty"], category: "project" },
  { query: "pkapp", topSlugs: ["github/repos/pkyanam-pkapp"], category: "project" },
  { query: "agentmeld music", topSlugs: ["github/repos/pkyanam-agentmeld-music"], category: "project" },
  { query: "belweave landing", topSlugs: ["github/repos/pkyanam-belweave-landing"], category: "project" },
  { query: "unibot", topSlugs: ["github/repos/pkyanam-unibot"], category: "project" },
  { query: "pkwellness", topSlugs: ["github/repos/pkyanam-pkwellness"], category: "project" },
  { query: "clawchest", topSlugs: ["github/repos/pkyanam-clawchest-reloaded"], category: "project" },
  { query: "renaissance me", topSlugs: ["github/repos/pkyanam-renaissance-me-next"], category: "project" },
  { query: "bytehabits", topSlugs: ["github/repos/pkyanam-bytehabits"], category: "project" },
  { query: "storyteller", topSlugs: ["github/repos/pkyanam-storyteller"], category: "project" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 6: Concept
  // ═══════════════════════════════════════════════════════════════
  { query: "Memory Wall", topSlugs: ["concepts/memory-wall"], category: "concept" },
  { query: "memory wall", topSlugs: ["concepts/memory-wall"], category: "concept" },
  { query: "CopyFail", topSlugs: ["concepts/copyfail-cve-2026-31431"], category: "concept" },
  { query: "Vera Language", topSlugs: ["concepts/vera-language"], category: "concept" },
  { query: "Decentralized Code Forges", topSlugs: ["concepts/decentralized-code-forges"], category: "concept" },
  { query: "YC RFS Gaps", topSlugs: ["concepts/yc-rfs-gaps"], category: "concept" },
  { query: "Next YC RFS Predictions", topSlugs: ["concepts/next-yc-rfs-predictions"], category: "concept" },
  { query: "GBrain", topSlugs: ["concepts/gbrain"], category: "concept" },
  { query: "knowledge brain automation gap", topSlugs: ["concepts/knowledge-brain-automation-gap"], category: "concept" },
  { query: "Market Viability Agent Infrastructure", topSlugs: ["research/market-viability-agent-infrastructure"], category: "concept" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 7: Relationship / Possessive
  // ═══════════════════════════════════════════════════════════════
  { query: "my mom", topSlugs: ["mom"], category: "relationship" },
  { query: "my dad", topSlugs: ["dad"], category: "relationship" },
  { query: "my sister", topSlugs: ["meghna-kyanam"], category: "relationship" },
  { query: "Preetham's sister", topSlugs: ["meghna-kyanam"], category: "relationship" },
  { query: "mom phone number", topSlugs: ["mom"], category: "relationship" },
  { query: "dad email", topSlugs: ["dad"], category: "relationship" },
  { query: "Kyanam Family Friends", topSlugs: ["kyanam-family-friends"], category: "relationship" },
  { query: "who helps me with AI agents", topSlugs: ["agents/lara"], category: "relationship" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 8: Tweet — ordinal
  // ═══════════════════════════════════════════════════════════════
  { query: "first tweet", topSlugs: ["tweets/pkyanam-first"], category: "tweet_ordinal" },
  { query: "last tweet", topSlugs: ["tweets/pkyanam-latest"], category: "tweet_ordinal" },
  { query: "my first tweet", topSlugs: ["tweets/pkyanam-first"], category: "tweet_ordinal" },
  { query: "my last tweet", topSlugs: ["tweets/pkyanam-latest"], category: "tweet_ordinal" },
  { query: "latest tweet", topSlugs: ["tweets/pkyanam-latest"], category: "tweet_ordinal" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 9: Tweet — entity mention
  // ═══════════════════════════════════════════════════════════════
  { query: "tweets about Apple", topSlugs: ["tweets/pkyanam-apple-001"], category: "tweet_mention" },
  { query: "tweets about Stripe", topSlugs: ["tweets/pkyanam-stripe-001"], category: "tweet_mention" },
  { query: "tweets about YC", topSlugs: ["tweets/pkyanam-yc-001"], category: "tweet_mention" },
  { query: "tweets about AI", topSlugs: ["tweets/pkyanam-ai-001"], category: "tweet_mention" },
  { query: "my tweets about coding", topSlugs: ["tweets/pkyanam-coding-001"], category: "tweet_mention" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 10: Tweet — date / temporal
  // ═══════════════════════════════════════════════════════════════
  { query: "tweets from 2024", topSlugs: ["tweets/pkyanam-2024-001"], category: "tweet_date" },
  { query: "tweets from April 2025", topSlugs: ["tweets/pkyanam-2025-04-001"], category: "tweet_date" },
  { query: "tweets from 2014", topSlugs: ["tweets/pkyanam-2014-001"], category: "tweet_date" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 11: Typo tolerance
  // ═══════════════════════════════════════════════════════════════
  { query: "hermies", topSlugs: ["software/hermes-agent"], category: "typo" },
  { query: "branbase", topSlugs: ["projects/brainbase"], category: "typo" },
  { query: "Garry Tann", topSlugs: ["people/garry-tan"], category: "typo" },
  { query: "Preetham Kianam", topSlugs: ["people/preetham-kyanam"], category: "typo" },
  { query: "Meghna Kianam", topSlugs: ["meghna-kyanam"], category: "typo" },
  { query: "Open A I", topSlugs: ["companies/openai"], category: "typo" },
  { query: "Vercell", topSlugs: ["companies/vercel"], category: "typo" },
  { query: "Clouflare", topSlugs: ["companies/cloudflare"], category: "typo" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 12: Acronym / Initialism
  // ═══════════════════════════════════════════════════════════════
  { query: "YC", topSlugs: ["companies/yc"], category: "acronym" },
  { query: "UVA", topSlugs: ["university-of-virginia"], category: "acronym" },
  { query: "AI", topSlugs: ["concepts/artificial-intelligence"], category: "acronym" },
  { query: "CEO", topSlugs: ["people/sam-altman"], category: "acronym" },
  { query: "MCP", topSlugs: ["concepts/model-context-protocol"], category: "acronym" },
  { query: "RFS", topSlugs: ["concepts/yc-rfs-gaps"], category: "acronym" },
  { query: "CVE", topSlugs: ["concepts/copyfail-cve-2026-31431"], category: "acronym" },
  { query: "GPU", topSlugs: ["concepts/gpu"], category: "acronym" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 13: General / Topic
  // ═══════════════════════════════════════════════════════════════
  { query: "AI startups", topSlugs: ["concepts/ai-startups"], category: "general" },
  { query: "cloud computing", topSlugs: ["concepts/cloud-computing"], category: "general" },
  { query: "knowledge graph", topSlugs: ["concepts/knowledge-graph"], category: "general" },
  { query: "agent infrastructure", topSlugs: ["research/market-viability-agent-infrastructure"], category: "general" },
  { query: "memory latency bottleneck", topSlugs: ["concepts/memory-wall"], category: "general" },
  { query: "decentralized git", topSlugs: ["concepts/decentralized-code-forges"], category: "general" },
  { query: "YC office hours", topSlugs: ["pitches/brainbase-yc-office-hours-feedback"], category: "general" },
  { query: "automation in knowledge brains", topSlugs: ["ideas/value-of-automation-in-knowledge-brains"], category: "general" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 14: Issue / Bug / Diagnostic
  // ═══════════════════════════════════════════════════════════════
  { query: "what's wrong with search", topSlugs: ["projects/brainbase/ops-log"], category: "issue" },
  { query: "search broken", topSlugs: ["projects/brainbase/ops-log"], category: "issue" },
  { query: "bug in brainbase", topSlugs: ["projects/brainbase/ops-log"], category: "issue" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 15: Multi-entity
  // ═══════════════════════════════════════════════════════════════
  { query: "Preetham and Meghna", topSlugs: ["people/preetham-kyanam", "meghna-kyanam"], category: "multi_entity" },
  { query: "mom and dad", topSlugs: ["mom", "dad"], category: "multi_entity" },
  { query: "Apple and OpenAI", topSlugs: ["companies/apple", "companies/openai"], category: "multi_entity" },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY 16: Temporal / Event
  // ═══════════════════════════════════════════════════════════════
  { query: "what happened last weekend", topSlugs: ["timeline/weekend-2026-04-26"], category: "temporal" },
  { query: "recent events", topSlugs: ["projects/brainbase/ops-log"], category: "temporal" },
  { query: "latest update", topSlugs: ["projects/brainbase/ops-log"], category: "temporal" },
];
