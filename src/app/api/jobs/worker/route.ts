/**
 * Minion Worker Tick — Invoked by Vercel cron to process queued jobs.
 *
 * Registers all built-in handlers, then processes one batch tick.
 * This is the serverless equivalent of GBrain's `gbrain jobs work` command.
 *
 * Cron schedule: every 1 minute (or configurable via vercel.json)
 *
 * Security: requires a shared secret (CRON_SECRET) in production,
 * and also accepts Clerk-authenticated requests for manual triggering.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { register } from "@/lib/minions/worker";
import { processTick } from "@/lib/minions/worker";

// Import handlers to register them
import { syncHandler } from "@/lib/minions/handlers/sync";
import { embedHandler } from "@/lib/minions/handlers/embed";
import { extractHandler } from "@/lib/minions/handlers/extract";
import { backlinksHandler } from "@/lib/minions/handlers/backlinks";
import { enrichHandler } from "@/lib/minions/handlers/enrich";

// Register at module load time
register("sync", syncHandler);
register("embed", embedHandler);
register("extract", extractHandler);
register("backlinks", backlinksHandler);
register("enrich_entity", enrichHandler);

export async function POST(req: NextRequest) {
  // Allow cron secret OR authenticated user
  const cronSecret = process.env.CRON_SECRET;
  const apiCronSecret = process.env.API_CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (cronSecret || apiCronSecret) {
    const provided = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (provided !== cronSecret && provided !== apiCronSecret) {
      // Fall back to Clerk auth
      const auth = await resolveApiAuth(req);
      if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
  } else {
    // No cron secret set — require Clerk auth
    const auth = await resolveApiAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const queueName = new URL(req.url).searchParams.get("queue") || "default";
  const batchSize = parseInt(
    new URL(req.url).searchParams.get("batch") || "5",
    10
  );

  try {
    const result = await processTick(queueName, Math.min(batchSize, 10));
    return NextResponse.json({
      ok: true,
      queue: queueName,
      ...result,
    });
  } catch (err) {
    console.error("[brainbase] Worker tick error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Worker tick failed",
      },
      { status: 500 }
    );
  }
}
