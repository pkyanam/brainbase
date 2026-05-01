/**
 * GET /api/eval/candidates — list captured query candidates
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/auth-guard";
import { getEvalCandidates } from "@/lib/eval-pipeline";

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const since = url.searchParams.get("since") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const tool = url.searchParams.get("tool") || undefined;

    const candidates = await getEvalCandidates(auth.brainId, { since, limit, tool });
    return NextResponse.json({ candidates });
  } catch (err) {
    console.error("[eval/candidates] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch candidates", detail: String(err) },
      { status: 500 }
    );
  }
}
