/**
 * POST /api/ask
 * Natural language Q&A over the brain.
 *
 * Body: { q: string, limit?: number }
 * Returns: { answer, sources, confidence, intent, searchedAt }
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { askBrain } from "@/lib/ask-engine";

export async function POST(req: NextRequest) {
  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const q = body.q || "";
    const limit = Math.min(Number(body.limit) || 5, 10);

    if (!q || typeof q !== "string" || q.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'q' field" },
        { status: 400 }
      );
    }

    const result = await askBrain(auth.brainId, q.trim(), limit);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[brainbase] /api/ask error:", err);
    return NextResponse.json(
      { error: "Failed to generate answer" },
      { status: 500 }
    );
  }
}
