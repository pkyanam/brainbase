/**
 * GET /api/cron/dream
 *
 * Vercel Cron Job endpoint — runs every 6 hours.
 * Processes all brains incrementally (small batches per brain).
 *
 * Secured by CRON_SECRET env var. Vercel sends this as
 * Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { queryMany } from "@/lib/supabase/client";
import { submitJob } from "@/lib/minions/queue";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  // In dev, allow unauthenticated calls
  const isDev = process.env.NODE_ENV === "development";
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!isDev && cronSecret && bearer !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all brains that have pages
    const brains = await queryMany<{ brain_id: string; page_count: number }>(
      `SELECT brain_id, COUNT(*)::int as page_count
       FROM pages
       GROUP BY brain_id
       HAVING COUNT(*) > 0
       ORDER BY COUNT(*) DESC`
    );

    const submitted: Array<{ brain_id: string; name: string; job_id: number }> = [];

    for (const brain of brains.slice(0, 10)) {
      // Submit extract job (finds new links + timeline entries)
      const extract = await submitJob("extract", {
        brain_id: brain.brain_id,
        data: { full: false },
      });
      submitted.push({ brain_id: brain.brain_id, name: "extract", job_id: extract.id });

      // Submit backlinks job (enforces reciprocal links)
      const backlinks = await submitJob("backlinks", {
        brain_id: brain.brain_id,
        data: {},
      });
      submitted.push({ brain_id: brain.brain_id, name: "backlinks", job_id: backlinks.id });

      // Submit embed job (for any un-embedded chunks)
      const embed = await submitJob("embed", {
        brain_id: brain.brain_id,
        data: {},
      });
      submitted.push({ brain_id: brain.brain_id, name: "embed", job_id: embed.id });
    }

    return NextResponse.json({
      status: "ok",
      brains_scheduled: brains.slice(0, 10).length,
      jobs_submitted: submitted.length,
      jobs: submitted,
    });
  } catch (err) {
    console.error("[brainbase] Cron dream error:", err);
    return NextResponse.json(
      { error: "Cron dream failed", message: String(err) },
      { status: 500 }
    );
  }
}
