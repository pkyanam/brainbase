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
import { runDreamCycle } from "@/lib/dream-cycle";
import { queryMany } from "@/lib/supabase/client";

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

    const reports = [];
    for (const brain of brains.slice(0, 10)) {
      try {
        const report = await runDreamCycle(brain.brain_id, 15);
        reports.push({ brain_id: brain.brain_id, ...report });
      } catch (err) {
        reports.push({
          brain_id: brain.brain_id,
          status: "failed",
          error: String(err),
        });
      }
    }

    return NextResponse.json({
      status: "ok",
      brains_processed: reports.length,
      reports,
    });
  } catch (err) {
    console.error("[brainbase] Cron dream error:", err);
    return NextResponse.json(
      { error: "Cron dream failed", message: String(err) },
      { status: 500 }
    );
  }
}
