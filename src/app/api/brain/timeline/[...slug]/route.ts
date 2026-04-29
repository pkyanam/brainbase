import { NextRequest, NextResponse } from "next/server";
import { getTimeline } from "@/lib/supabase/pages";
import { requireOwner } from "@/lib/auth-guard";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  const resolved = await params;
  const slug = resolved.slug?.join("/") || "";

  if (!slug) {
    return NextResponse.json({ error: "Missing page slug" }, { status: 400 });
  }

  try {
    const timeline = await getTimeline(auth.brainId, slug);
    return NextResponse.json({ slug, timeline });
  } catch (err) {
    console.error("[brainbase] Timeline endpoint error:", err);
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 });
  }
}
