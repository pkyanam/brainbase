/**
 * POST /api/cron/dream-phase — run ONE dream phase for ONE brain.
 *
 * Atomic unit of work for Convex orchestration.
 * Each call should complete in <10s (Vercel Hobby limit).
 *
 * Query params:
 *   - brain_id: required
 *   - phase: one of extract_links, tweet_link, link_orphans, synthesize, patterns, embed
 *   - limit: optional max items to process (default varies by phase)
 */
import { NextRequest, NextResponse } from "next/server";
import { queryMany } from "@/lib/supabase/client";

const PHASES = ["extract_links", "tweet_link", "link_orphans", "synthesize", "patterns", "embed", "graph_sync"] as const;
type Phase = typeof PHASES[number];

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const hermesSecret = process.env.HERMES_CRON_SECRET;
  const apiCronSecret = process.env.API_CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  const isDev = process.env.NODE_ENV === "development";

  const authorized = isDev ||
    (cronSecret && bearer === cronSecret) ||
    (hermesSecret && bearer === hermesSecret) ||
    (apiCronSecret && bearer === apiCronSecret);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { brain_id?: string; phase?: string; limit?: number } = {};
  try { body = await req.json().catch(() => ({})); } catch {}

  const brainId = body.brain_id;
  const phase = body.phase as Phase;
  const limit = body.limit;

  if (!brainId || !PHASES.includes(phase)) {
    return NextResponse.json({ error: "Missing brain_id or invalid phase" }, { status: 400 });
  }

  const t0 = Date.now();
  try {
    let result: any;

    switch (phase) {
      case "extract_links": {
        const { extractLinksFromStalePages } = await import("@/lib/auto-extract");
        result = await extractLinksFromStalePages(brainId, limit || 200);
        break;
      }
      case "tweet_link": {
        const { linkTweetsToAuthors } = await import("@/lib/tweet-linker");
        result = await linkTweetsToAuthors(brainId, limit || 500);
        break;
      }
      case "link_orphans": {
        const { batchLinkOrphans } = await import("@/lib/orphan-linker");
        result = await batchLinkOrphans(brainId);
        break;
      }
      case "synthesize": {
        const { runSynthesizePhase } = await import("@/lib/dream/synthesize");
        result = await runSynthesizePhase(brainId);
        break;
      }
      case "patterns": {
        const { detectDreamPatterns } = await import("@/lib/dream/patterns");
        result = await detectDreamPatterns(brainId, limit || 30, 2);
        break;
      }
      case "embed": {
        const { countStaleChunks, runEmbedPipeline } = await import("@/lib/embed-pipeline");
        const stale = await countStaleChunks(brainId);
        if (stale > 0) {
          result = await runEmbedPipeline(brainId, "stale");
        } else {
          result = { chunks_embedded: 0, total_chunks: 0, skipped: true };
        }
        break;
      }
      case "graph_sync": {
        const { syncBrainGraph } = await import("@/lib/neo4j/sync");
        // `limit` doubles as the per-batch cap; `forceFull` triggered by passing limit=0.
        result = await syncBrainGraph(brainId, {
          forceFull: limit === 0,
          limit: limit && limit > 0 ? limit : undefined,
        });
        break;
      }
    }

    return NextResponse.json({
      status: "ok",
      brain_id: brainId,
      phase,
      result,
      duration_ms: Date.now() - t0,
    });
  } catch (err: any) {
    console.error(`[brainbase] Dream phase ${phase} failed for ${brainId}:`, err);
    return NextResponse.json(
      { error: "Phase failed", phase, brain_id: brainId, message: String(err.message) },
      { status: 500 }
    );
  }
}
