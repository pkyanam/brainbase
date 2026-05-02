import { NextRequest, NextResponse } from "next/server";
import { searchBrain } from "@/lib/supabase/search";
import { requireOwner } from "@/lib/auth-guard";
import { requireQuota } from "@/lib/usage";
import { query } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  const q = request.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json(
      { error: "Missing query parameter 'q'" },
      { status: 400 }
    );
  }

  // Rate limit check
  const quotaCheck = await requireQuota(auth.brainId, "search");
  if (quotaCheck) return quotaCheck;

  try {
    const results = await searchBrain(auth.brainId, q);

    // ── Eval capture (synchronous — Vercel Hobby kills fire-and-forget) ──
    try {
      await query(`CREATE TABLE IF NOT EXISTS eval_candidates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brain_id UUID NOT NULL, tool TEXT NOT NULL,
        query_text TEXT NOT NULL, result_count INTEGER,
        top_slugs TEXT[], meta JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`);
      await query(
        `INSERT INTO eval_candidates (brain_id, tool, query_text, result_count, top_slugs, meta)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [auth.brainId, "search", q, results.length, results.slice(0, 5).map(r => r.slug), JSON.stringify({})]
      );
    } catch (e) {
      console.error("[search] Capture error:", e);
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("[brainbase] Search error:", err);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
