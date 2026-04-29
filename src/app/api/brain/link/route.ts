import { NextRequest, NextResponse } from "next/server";
import { addLink, removeLink } from "@/lib/supabase/write";
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

  let body: { from?: string; to?: string; link_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { from, to, link_type } = body;
  if (!from || !to) {
    return NextResponse.json({ error: "Missing 'from' or 'to' slug" }, { status: 400 });
  }

  try {
    const created = await addLink(keyData.brainId, from, to, link_type);
    return NextResponse.json({ success: created, from, to, link_type: link_type || "related" });
  } catch (err) {
    console.error("[brainbase] Add link error:", err);
    return NextResponse.json({ error: "Failed to add link" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing Authorization header. Use: Bearer bb_live_..." }, { status: 401 });
  }
  const keyData = await validateApiKey(token);
  if (!keyData) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }

  let body: { from?: string; to?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { from, to } = body;
  if (!from || !to) {
    return NextResponse.json({ error: "Missing 'from' or 'to' slug" }, { status: 400 });
  }

  try {
    const removed = await removeLink(keyData.brainId, from, to);
    return NextResponse.json({ success: removed, from, to });
  } catch (err) {
    console.error("[brainbase] Remove link error:", err);
    return NextResponse.json({ error: "Failed to remove link" }, { status: 500 });
  }
}
