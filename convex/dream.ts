"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { listBrains, runDreamPhase, embedBrainChunks, linkOrphansDirectly } from "./lib/brainbase";

const PHASES = [
  "extract_links",
  "tweet_link",
  "link_orphans",
  "synthesize",
  "patterns",
  "embed",
] as const;

/**
 * Discover all brains and kick off the dream cycle for each.
 * Called by the daily cron.
 */
export const discoverAndRunDreamCycle = internalAction({
  args: {},
  handler: async (ctx) => {
    const brains = await listBrains();
    const brainIds = brains.map((b) => b.brain_id);
    console.log(`[convex:dream] Discovered ${brainIds.length} brains`);

    if (brainIds.length === 0) {
      return { status: "no-brains" };
    }

    // Stagger brain processing by 60s each to avoid Vercel overload
    for (let i = 0; i < brainIds.length; i++) {
      // @ts-ignore — types regenerate after `npx convex dev`
      await ctx.scheduler.runAfter(i * 60_000, internal.dream.runBrainDreamCycle, {
        brainId: brainIds[i],
        phaseIndex: 0,
      });
    }

    return { status: "scheduled", brains: brainIds.length };
  },
});

/**
 * Run the full dream cycle for a single brain, phase by phase.
 * Each phase is a separate HTTP call to a Vercel endpoint.
 * If one phase fails, we log and continue with the next.
 */
export const runBrainDreamCycle = internalAction({
  args: {
    brainId: v.string(),
    phaseIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const idx = args.phaseIndex ?? 0;

    if (idx >= PHASES.length) {
      console.log(`[convex:dream] Completed all phases for ${args.brainId}`);
      return { status: "completed", brainId: args.brainId };
    }

    const phase = PHASES[idx];
    console.log(`[convex:dream] Running ${phase} for ${args.brainId}`);

    try {
      if (phase === "link_orphans") {
        // Run orphan linker directly on Convex (Supabase pg), not via Vercel proxy
        const result = await linkOrphansDirectly(args.brainId);
        console.log(`[convex:dream] ${phase} ok: ${result.totalInserted} links created, ${result.orphansFound} orphans remaining`);
        
        // If we processed a batch but orphans remain, schedule another orphan pass before continuing
        if (result.orphansFound > result.totalInserted && result.totalInserted > 0) {
          console.log(`[convex:dream] ${result.orphansFound} orphans remain, scheduling another pass`);
          // @ts-ignore — types regenerate after `npx convex dev`
          await ctx.scheduler.runAfter(5_000, internal.dream.runBrainDreamCycle, {
            brainId: args.brainId,
            phaseIndex: idx, // stay on link_orphans
          });
          return { status: "running", brainId: args.brainId, phase, nextIndex: idx, orphansRemaining: result.orphansFound };
        }
      } else {
        const result = await runDreamPhase(args.brainId, phase);
        console.log(`[convex:dream] ${phase} ok:`, JSON.stringify(result).slice(0, 200));
      }
    } catch (err: any) {
      console.error(`[convex:dream] ${phase} failed for ${args.brainId}:`, err.message);
    }

    // Schedule next phase (5s delay to let Vercel cool down)
    // @ts-ignore — types regenerate after `npx convex dev`
    await ctx.scheduler.runAfter(5_000, internal.dream.runBrainDreamCycle, {
      brainId: args.brainId,
      phaseIndex: idx + 1,
    });

    return { status: "running", brainId: args.brainId, phase, nextIndex: idx + 1 };
  },
});

/**
 * Discover all brains and run embed for each.
 * Called by the hourly cron.
 */
export const discoverAndRunEmbed = internalAction({
  args: {},
  handler: async (ctx) => {
    const brains = await listBrains();
    console.log(`[convex:embed] Discovered ${brains.length} brains`);

    for (let i = 0; i < brains.length; i++) {
      // @ts-ignore — types regenerate after `npx convex dev`
      await ctx.scheduler.runAfter(i * 30_000, internal.dream.runBrainEmbed, {
        brainId: brains[i].brain_id,
      });
    }

    return { status: "scheduled", brains: brains.length };
  },
});

/**
 * Run embed pipeline for a single brain.
 */
export const runBrainEmbed = internalAction({
  args: { brainId: v.string() },
  handler: async (_ctx, args) => {
    console.log(`[convex:embed] Embedding ${args.brainId}`);
    try {
      const result = await embedBrainChunks(args.brainId, 40);
      console.log(`[convex:embed] Done:`, JSON.stringify(result).slice(0, 200));
      return { status: "ok", brainId: args.brainId, result };
    } catch (err: any) {
      console.error(`[convex:embed] Failed for ${args.brainId}:`, err.message);
      return { status: "error", brainId: args.brainId, error: err.message };
    }
  },
});
