/**
 * POST /api/brain/dream
 * Run the autonomous dream cycle on a brain.
 * Requires brain_id in the JSON body.
 *
 * The dream cycle makes the brain smarter without human input:
 *   1. Extract links + timeline from recently-updated pages
 *   2. Check for stale embeddings
 *   3. Find orphans
 *   4. Detect cross-page patterns
 *   5. Auto-escalate entity enrichment tiers
 */

import { NextRequest } from "next/server";
import { runDreamCycle, DreamReport } from "@/lib/dream-cycle";

export async function POST(req: NextRequest) {
  const { brain_id } = await req.json().catch(() => ({}));
  if (!brain_id) {
    return Response.json({ error: "brain_id required" }, { status: 400 });
  }

  try {
    const report: DreamReport = await runDreamCycle(brain_id);
    return Response.json(report, { status: 200 });
  } catch (err) {
    console.error("[brainbase] Dream cycle error:", err);
    return Response.json(
      { error: "Dream cycle failed", message: String(err) },
      { status: 500 }
    );
  }
}
