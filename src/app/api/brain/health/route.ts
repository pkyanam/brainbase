import { NextRequest, NextResponse } from "next/server";
import { getHealth } from "@/lib/supabase/health";
import { getBrainScore, runDoctorChecks } from "@/lib/doctor";
import { requireBrainAccess } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  try {
    // Fetch stats, brain score, and doctor checks in parallel
    const [health, brainScore, doctor] = await Promise.all([
      getHealth(auth.brainId),
      getBrainScore(auth.brainId),
      runDoctorChecks(auth.brainId),
    ]);

    return NextResponse.json({
      stats: {
        page_count: health.page_count,
        chunk_count: health.chunk_count,
        link_count: health.link_count,
        embed_coverage: health.embed_coverage,
      },
      brain_score: brainScore,
      doctor,
    });
  } catch (err) {
    console.error("[brainbase] Health endpoint error:", err);
    return NextResponse.json(
      { error: "Failed to fetch brain health" },
      { status: 500 }
    );
  }
}
