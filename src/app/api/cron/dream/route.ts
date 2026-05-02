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
  const hermesSecret = process.env.HERMES_CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  // In dev, allow unauthenticated calls
  const isDev = process.env.NODE_ENV === "development";
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  // Accept either CRON_SECRET or HERMES_CRON_SECRET
  const authorized = isDev ||
    (cronSecret && bearer === cronSecret) ||
    (hermesSecret && bearer === hermesSecret);

  if (!authorized) {
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

    const results: Array<{ brain_id: string; status: string; phases: Array<{ phase: string; status: string; summary: string; items_processed?: number; items_created?: number; duration_ms: number }>; totals: Record<string, number> }> = [];

    for (const brain of brains.slice(0, 10)) {
      try {
        const report = await runDreamCycle(brain.brain_id, false);
        
        // Aggregate per-phase metrics into totals
        const totals: Record<string, number> = {
          phases: report.phases.length,
          duration_ms: report.total_duration_ms,
        };
        for (const phase of report.phases) {
          if (phase.items_processed) totals[`${phase.phase}_processed`] = phase.items_processed;
          if (phase.items_created) totals[`${phase.phase}_created`] = phase.items_created;
        }
        
        results.push({
          brain_id: brain.brain_id,
          status: "completed",
          phases: report.phases.map(p => ({
            phase: p.phase,
            status: p.status,
            summary: p.summary,
            items_processed: p.items_processed,
            items_created: p.items_created,
            details: p.details,
            duration_ms: p.duration_ms,
          })),
          totals,
        });
      } catch (err) {
        console.error(`[brainbase] Dream cycle failed for ${brain.brain_id}:`, err);
        results.push({
          brain_id: brain.brain_id,
          status: "failed",
          phases: [],
          totals: {},
        });
      }
    }

    const totalLinksCreated = results.reduce((sum, r) => sum + (r.totals.extract_links_created || 0) + (r.totals.tweet_author_link_created || 0) + (r.totals.link_orphans_created || 0), 0);
    const totalEmbedded = results.reduce((sum, r) => sum + (r.totals.embed_processed || 0), 0);
    const totalTweetsLinked = results.reduce((sum, r) => sum + (r.totals.tweet_author_link_created || 0), 0);

    return NextResponse.json({
      status: "ok",
      brains_processed: results.length,
      total_links_created: totalLinksCreated,
      total_chunks_embedded: totalEmbedded,
      total_tweets_linked: totalTweetsLinked,
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
