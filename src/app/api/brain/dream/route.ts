/**
 * POST /api/brain/dream
 * Run the autonomous dream cycle on a brain.
 *
 * Query params: ?phase=synthesize|patterns|all
 * Body: { process_all?: boolean }
 *
 * GBrain v0.25 — 8-phase dream cycle.
 * Auth: API key (Bearer) or Clerk session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { runDreamCycle } from "@/lib/dream-cycle";
import { runSynthesizePhase } from "@/lib/dream/synthesize";
import { detectDreamPatterns } from "@/lib/dream/patterns";
import { queryOne } from "@/lib/supabase/client";

type PhaseParam = "synthesize" | "patterns" | "all";

export async function POST(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  let body: { process_all?: boolean } = {};
  try { body = await req.json(); } catch { /* no body is fine */ }

  const phase = (req.nextUrl.searchParams.get("phase") || "all") as PhaseParam;

  try {
    if (phase === "synthesize") {
      const result = await runSynthesizePhase(auth.brainId);
      return NextResponse.json({ timestamp: new Date().toISOString(), phase: "synthesize", result });
    }

    if (phase === "patterns") {
      const lookbackDays = parseInt(req.nextUrl.searchParams.get("lookback_days") || "30", 10);
      const minEvidence = parseInt(req.nextUrl.searchParams.get("min_evidence") || "2", 10);
      const result = await detectDreamPatterns(auth.brainId, lookbackDays, minEvidence);
      return NextResponse.json({ timestamp: new Date().toISOString(), phase: "patterns", result });
    }

    // Phase "all" — run the full 8-phase dream cycle
    const report = await runDreamCycle(auth.brainId, body.process_all === true);
    return NextResponse.json(report);
  } catch (err) {
    console.error("[brainbase] Dream cycle error:", err);
    return NextResponse.json({ error: "Dream cycle failed", message: String(err) }, { status: 500 });
  }
}

/**
 * GET /api/brain/dream — lightweight dream status
 */
export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  try {
    const pageCount = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int as cnt FROM pages WHERE brain_id = $1`, [auth.brainId]
    );
    const linkCount = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int as cnt FROM links WHERE brain_id = $1`, [auth.brainId]
    );
    const staleChunks = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int as cnt FROM content_chunks WHERE brain_id = $1 AND embedding IS NULL`, [auth.brainId]
    );
    const dreamPages = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int as cnt FROM pages WHERE brain_id = $1 AND (frontmatter->>'dream_generated')::boolean = true`, [auth.brainId]
    );
    const orphanCount = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int as cnt FROM pages p WHERE p.brain_id = $1 AND NOT EXISTS (SELECT 1 FROM links l WHERE l.brain_id = $1 AND l.to_page_id = p.id)`,
      [auth.brainId]
    );
    const lastExtracted = await queryOne<{ ts: string | null }>(
      `SELECT MAX(updated_at)::text as ts FROM pages WHERE brain_id = $1`, [auth.brainId]
    );

    return NextResponse.json({
      brain_id: auth.brainId,
      status: "ok",
      pages: pageCount?.cnt || 0,
      links: linkCount?.cnt || 0,
      orphans: orphanCount?.cnt ?? 0,
      stale_chunks: staleChunks?.cnt ?? 0,
      tiered_entities: dreamPages?.cnt ?? 0,
      last_extracted_at: lastExtracted?.ts || null,
    });
  } catch (err) {
    console.error("[brainbase] Dream status error:", err);
    return NextResponse.json({ error: "Failed to fetch dream status" }, { status: 500 });
  }
}
