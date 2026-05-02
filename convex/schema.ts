import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Eval candidates: captured queries from search/query endpoints ──
  evalCandidates: defineTable({
    brainId: v.string(),
    tool: v.string(),        // "search" | "query"
    queryText: v.string(),
    resultCount: v.number(),
    topSlugs: v.array(v.string()),
    meta: v.optional(v.any()),
  })
    .index("by_brain", ["brainId", "tool"]),

  // ── Eval runs: batch eval execution records ──
  evalRuns: defineTable({
    brainId: v.string(),
    status: v.string(),       // "running" | "completed" | "failed"
    totalQueries: v.number(),
    avgMrr: v.optional(v.number()),
    avgP3: v.optional(v.number()),
    avgP5: v.optional(v.number()),
    avgLatencyMs: v.optional(v.number()),
    passed: v.number(),
    failed: v.number(),
    baselineId: v.optional(v.id("evalRuns")),
    meta: v.optional(v.any()),
    completedAt: v.optional(v.number()),
  })
    .index("by_brain", ["brainId"]),

  // ── Eval results: per-query metrics ──
  evalResults: defineTable({
    runId: v.id("evalRuns"),
    queryText: v.string(),
    returnedSlugs: v.array(v.string()),
    expectedSlugs: v.array(v.string()),
    mrr: v.number(),
    p3: v.number(),
    p5: v.number(),
    latencyMs: v.number(),
    passed: v.boolean(),
    rawMeta: v.optional(v.any()),
  })
    .index("by_run", ["runId", "passed"]),

  // ── Lara Eval (completely separate from Arlan's eval) ──
  laraEvalCandidates: defineTable({
    brainId: v.string(),
    tool: v.string(),
    queryText: v.string(),
    resultCount: v.number(),
    topSlugs: v.array(v.string()),
    category: v.string(),
    meta: v.optional(v.any()),
  })
    .index("by_brain", ["brainId"]),

  laraEvalRuns: defineTable({
    brainId: v.string(),
    status: v.string(),
    totalQueries: v.number(),
    avgMrr: v.optional(v.number()),
    avgP3: v.optional(v.number()),
    avgP5: v.optional(v.number()),
    avgLatencyMs: v.optional(v.number()),
    passed: v.number(),
    failed: v.number(),
    baselineId: v.optional(v.id("laraEvalRuns")),
    meta: v.optional(v.any()),
    completedAt: v.optional(v.number()),
  })
    .index("by_brain", ["brainId"]),

  laraEvalResults: defineTable({
    runId: v.id("laraEvalRuns"),
    queryText: v.string(),
    returnedSlugs: v.array(v.string()),
    expectedSlugs: v.array(v.string()),
    mrr: v.number(),
    p3: v.number(),
    p5: v.number(),
    latencyMs: v.number(),
    passed: v.boolean(),
  })
    .index("by_run", ["runId"]),
});
