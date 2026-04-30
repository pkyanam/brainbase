/**
 * GET /api/cron/dream
 *
 * Vercel Cron Job endpoint — runs daily at midnight.
 * Runs the autonomous dream cycle on all brains:
 *   1. Extract links + timeline from updated pages
 *   2. Extract frontmatter edges
 *   3. Embed stale chunks (batch of 50 per brain)
 *   4. Detect + auto-link orphans
 *   5. Detect cross-page patterns
 *   6. Entity tier auto-escalation
 *
 * Secured by CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { queryMany } from "@/lib/supabase/client";
import { runDreamCycle } from "@/lib/dream-cycle";

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

    const results: Array<{ brain_id: string; status: string; totals: Record<string, number> }> = [];

    for (const brain of brains.slice(0, 10)) {
      try {
        const report = await runDreamCycle(brain.brain_id, 200);
        results.push({
          brain_id: brain.brain_id,
          status: report.status,
          totals: report.totals,
        });
      } catch (err) {
        console.error(`[brainbase] Dream cycle failed for ${brain.brain_id}:`, err);
        results.push({
          brain_id: brain.brain_id,
          status: "failed",
          totals: {},
        });
      }
    }

    const totalEmbedded = results.reduce((sum, r) => sum + (r.totals.chunks_embedded || 0), 0);
    const totalLinked = results.reduce((sum, r) => sum + (r.totals.links_created || 0), 0);
    const totalOrphans = results.reduce((sum, r) => sum + (r.totals.orphans_found || 0), 0);

    return NextResponse.json({
      status: "ok",
      brains_processed: results.length,
      total_chunks_embedded: totalEmbedded,
      total_links_created: totalLinked,
      total_orphans_found: totalOrphans,
      results,
    });
  } catch (err) {
    console.error("[brainbase] Cron dream error:", err);
    return NextResponse.json(
      { error: "Cron dream failed", message: String(err) },
      { status: 500 }
    );
  }
}
