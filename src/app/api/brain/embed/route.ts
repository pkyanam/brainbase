/**
 * POST /api/brain/embed
 *
 * Regenerates embeddings for the brain.
 *
 * Body: { mode: "stale" | "all", slugs?: string[] }
 *   - "stale": embed only chunks with NULL embeddings
 *   - "all":   regenerate embeddings for every chunk
 *   - slugs:   optional array of page slugs to scope the operation
 *
 * Returns: { chunks_embedded: N, errors: N, duration_ms: N, total_chunks: N }
 *
 * Auth: API key (Bearer) or Clerk session, with optional ?brain_id=<id>.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { runEmbedPipeline, countStaleChunks, type EmbedMode } from "@/lib/embed-pipeline";

export async function POST(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  // Parse body
  let body: { mode?: string; slugs?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate mode
  const mode = body.mode;
  if (mode !== "stale" && mode !== "all") {
    return NextResponse.json(
      {
        error: "Invalid mode",
        message: 'mode must be "stale" or "all"',
      },
      { status: 400 }
    );
  }

  // Validate slugs if provided
  const slugs = body.slugs;
  if (slugs !== undefined && (!Array.isArray(slugs) || slugs.some((s) => typeof s !== "string"))) {
    return NextResponse.json(
      { error: "Invalid slugs", message: "slugs must be an array of strings" },
      { status: 400 }
    );
  }

  try {
    const result = await runEmbedPipeline(auth.brainId, mode as EmbedMode, slugs);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[brainbase] Embed pipeline error:", err);
    return NextResponse.json(
      { error: "Embed pipeline failed", message: String(err) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/brain/embed?brain_id=<id>
 *
 * Returns the count of stale (un-embedded) chunks and basic brain stats.
 */
export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  try {
    const staleCount = await countStaleChunks(auth.brainId);

    const { queryOne } = await import("@/lib/supabase/client");

    const totalChunks = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int as cnt FROM content_chunks WHERE brain_id = $1`,
      [auth.brainId]
    );

    const embeddedChunks = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int as cnt FROM content_chunks WHERE brain_id = $1 AND embedding IS NOT NULL`,
      [auth.brainId]
    );

    return NextResponse.json({
      brain_id: auth.brainId,
      stale_chunks: staleCount,
      total_chunks: totalChunks?.cnt || 0,
      embedded_chunks: embeddedChunks?.cnt || 0,
      coverage_pct: totalChunks?.cnt
        ? Math.round(((embeddedChunks?.cnt || 0) / totalChunks.cnt) * 100)
        : 0,
    });
  } catch (err) {
    console.error("[brainbase] Embed status error:", err);
    return NextResponse.json(
      { error: "Failed to fetch embed status" },
      { status: 500 }
    );
  }
}
