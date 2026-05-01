/**
 * GET /api/eval/list — list eval runs
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/auth-guard";
import { getEvalRuns } from "@/lib/eval-pipeline";

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const runs = await getEvalRuns(auth.brainId);
    return NextResponse.json({ runs });
  } catch (err) {
    console.error("[eval/list] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch eval runs", detail: String(err) },
      { status: 500 }
    );
  }
}
