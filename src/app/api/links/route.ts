import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { addLink } from "@/lib/supabase/write";

export async function POST(req: NextRequest) {
  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { from?: string; to?: string; link_type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { from, to, link_type } = body;
  if (!from || !to) {
    return NextResponse.json(
      { error: "Missing 'from' or 'to' slug" },
      { status: 400 }
    );
  }

  try {
    const created = await addLink(auth.brainId, from, to, link_type);
    return NextResponse.json({
      success: created,
      from,
      to,
      link_type: link_type || "related",
    });
  } catch (err) {
    console.error("[brainbase] /api/links POST error:", err);
    return NextResponse.json({ error: "Failed to create link" }, { status: 500 });
  }
}
