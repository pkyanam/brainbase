/**
 * GET /api/eval/list — list eval runs
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/auth-guard";
import { getEvalRuns } from "@/lib/eval-pipeline";

export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const runs = await getEvalRuns(auth.brainId);
  return NextResponse.json({ runs });
}
