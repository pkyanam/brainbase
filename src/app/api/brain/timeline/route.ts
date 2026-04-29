import { NextRequest, NextResponse } from "next/server";
import { addTimelineEntry } from "@/lib/supabase/write";
import { validateApiKey } from "@/lib/api-keys";

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing Authorization header. Use: Bearer bb_live_..." }, { status: 401 });
  }
  const keyData = await validateApiKey(token);
  if (!keyData) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }

  let body: { slug?: string; date?: string; summary?: string; detail?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { slug, date, summary, detail, source } = body;
  if (!slug || !date || !summary) {
    return NextResponse.json({ error: "Missing 'slug', 'date', or 'summary'" }, { status: 400 });
  }

  try {
    const result = await addTimelineEntry(keyData.brainId, { slug, date, summary, detail, source });
    return NextResponse.json({ success: true, id: result.id, slug, date, summary });
  } catch (err) {
    console.error("[brainbase] Add timeline error:", err);
    return NextResponse.json({ error: "Failed to add timeline entry" }, { status: 500 });
  }
}
