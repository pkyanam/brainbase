/**
 * GET /api/eval/export — export candidates as NDJSON
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/auth-guard";
import { getEvalCandidates } from "@/lib/eval-pipeline";

export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const since = url.searchParams.get("since") || undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 1000);
  const tool = url.searchParams.get("tool") || undefined;

  const candidates = await getEvalCandidates(auth.brainId, { since, limit, tool });

  const lines = candidates.map((c) =>
    JSON.stringify({
      schema_version: 1,
      tool: c.tool,
      query_text: c.query_text,
      top_slugs: c.top_slugs,
      captured_at: c.created_at,
      meta: c.meta,
    })
  );

  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": `attachment; filename="eval-candidates-${new Date().toISOString().slice(0, 10)}.ndjson"`,
    },
  });
}
