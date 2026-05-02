"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { runWorkerTick } from "./lib/brainbase";

/**
 * Minion worker tick — called every few minutes by cron.
 */
export const workerTick = internalAction({
  args: {
    queue: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const queue = args.queue || "default";
    const batchSize = Math.min(args.batchSize || 5, 10);

    console.log(`[convex:worker] Tick for queue '${queue}', batch ${batchSize}`);
    try {
      const result = await runWorkerTick(queue, batchSize);
      console.log(`[convex:worker] Tick ok:`, JSON.stringify(result).slice(0, 200));
      return { status: "ok", queue, result };
    } catch (err: any) {
      console.error(`[convex:worker] Tick failed:`, err.message);
      return { status: "error", queue, error: err.message };
    }
  },
});
