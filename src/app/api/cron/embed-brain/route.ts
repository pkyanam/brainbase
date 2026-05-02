/**
 * POST /api/cron/embed-brain — embed stale chunks for ONE brain.
 *
 * Atomic unit of work for Convex orchestration.
 */
import { NextRequest, NextResponse } from "next/server";
import { embedStaleChunks } from "@/lib/embeddings";

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

  let body: { brain_id?: string; limit?: number } = {};
  try { body = await req.json().catch(() => ({})); } catch {}

  const brainId = body.brain_id;
  const limit = Math.min(body.limit || 50, 200);

  if (!brainId) {
    return NextResponse.json({ error: "Missing brain_id" }, { status: 400 });
  }

  const t0 = Date.now();
  try {
    const embedded = await embedStaleChunks(brainId, limit);
    return NextResponse.json({
      status: "ok",
      brain_id: brainId,
      chunks_embedded: embedded,
      duration_ms: Date.now() - t0,
    });
  } catch (err: any) {
    console.error(`[brainbase] Embed failed for ${brainId}:`, err);
    return NextResponse.json(
      { error: "Embed failed", brain_id: brainId, message: String(err.message) },
      { status: 500 }
    );
  }
}
