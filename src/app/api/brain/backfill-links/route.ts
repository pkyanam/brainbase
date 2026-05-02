/**
 * POST /api/brain/backfill-links
 *
 * One-shot backfill: runs auto-extract on all existing pages
 * to wire up the graph. Processes in batches of 50 (<10s on Vercel Hobby).
 * Call repeatedly until it returns { complete: true }.
 *
 * Auth: Bearer token OR Clerk session OR Convex secret.
 * Optional query params: limit (default 50), offset (default 0).
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { queryMany } from "@/lib/supabase/client";
import { runAutoExtract } from "@/lib/auto-extract";

export async function POST(req: NextRequest) {
  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  try {
    // Fetch batch of pages sorted by most recently updated
    const pages = await queryMany<{
      slug: string;
      type: string;
      compiled_truth: string;
    }>(
      `SELECT p.slug, p.type, COALESCE(p.compiled_truth, '') as compiled_truth
       FROM pages p
       WHERE p.brain_id = $1
         AND p.compiled_truth IS NOT NULL
         AND p.compiled_truth != ''
       ORDER BY p.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [auth.brainId, limit, offset]
    );

    let totalLinks = 0;
    let totalTimeline = 0;
    const processed: string[] = [];

    for (const page of pages) {
      try {
        const result = await runAutoExtract(
          auth.brainId,
          page.slug,
          page.type,
          page.compiled_truth
        );
        totalLinks += result.linksCreated;
        totalTimeline += result.timelineCreated;
        processed.push(page.slug);
      } catch (err) {
        console.error(
          `[brainbase] Backfill error for ${page.slug}:`,
          err
        );
      }
    }

    const complete = pages.length < limit;

    return NextResponse.json({
      processed: processed.length,
      pagesInBatch: pages.length,
      linksCreated: totalLinks,
      timelineEntries: totalTimeline,
      offset,
      complete,
      ...(complete
        ? { message: "Backfill complete. All pages processed." }
        : {
            nextOffset: offset + processed.length,
            hint: `Call again with offset=${offset + processed.length} to continue.`,
          }),
    });
  } catch (err) {
    console.error("[brainbase] Backfill failed:", err);
    return NextResponse.json(
      { error: "Backfill failed" },
      { status: 500 }
    );
  }
}
