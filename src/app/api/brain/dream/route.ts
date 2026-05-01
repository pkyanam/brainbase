/**
 * POST /api/brain/dream
 * Run the autonomous dream cycle on a brain.
 *
 * Query params: ?brain_id=<id>
 * Body: { process_all?: boolean } — process all pages (not just a batch)
 *
 * Auth: API key (Bearer) or Clerk session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { runDreamCycle } from "@/lib/dream-cycle";

export async function POST(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  let body: { process_all?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine
  }

  const processAll = body.process_all === true;

  try {
    const report = await runDreamCycle(auth.brainId, processAll);
    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    console.error("[brainbase] Dream cycle error:", err);
    return NextResponse.json(
      { error: "Dream cycle failed", message: String(err) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/brain/dream?brain_id=<id>
 * Returns the most recent dream status for a brain.
 */
export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  try {
    // Return a lightweight status — just counts, no heavy processing
    const { queryOne, queryMany } = await import("@/lib/supabase/client");

    const pageCount = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int as cnt FROM pages WHERE brain_id = $1`,
      [auth.brainId]
    );
    const linkCount = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int as cnt FROM links WHERE brain_id = $1`,
      [auth.brainId]
    );
    const orphanCount = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int as cnt FROM pages p
       WHERE p.brain_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM links l
           WHERE l.brain_id = $1
             AND (l.from_page_id = p.id OR l.to_page_id = p.id)
         )`,
      [auth.brainId]
    );
    const staleChunks = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int as cnt FROM content_chunks WHERE brain_id = $1 AND embedding IS NULL`,
      [auth.brainId]
    );
    const tieredEntities = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int as cnt FROM pages
       WHERE brain_id = $1
         AND (frontmatter->>'enrichment_tier')::int > 0`,
      [auth.brainId]
    );
    const lastExtracted = await queryOne<{ max: string | null }>(
      `SELECT MAX(last_extracted_at) as max FROM pages WHERE brain_id = $1`,
      [auth.brainId]
    );

    return NextResponse.json({
      brain_id: auth.brainId,
      status: "ok",
      pages: pageCount?.cnt || 0,
      links: linkCount?.cnt || 0,
      orphans: orphanCount?.cnt || 0,
      stale_chunks: staleChunks?.cnt || 0,
      tiered_entities: tieredEntities?.cnt || 0,
      last_extracted_at: lastExtracted?.max || null,
    });
  } catch (err) {
    console.error("[brainbase] Dream status error:", err);
    return NextResponse.json(
      { error: "Failed to fetch dream status" },
      { status: 500 }
    );
  }
}
