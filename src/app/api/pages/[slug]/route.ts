import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { getPage, getPageLinks, getTimeline } from "@/lib/supabase/pages";
import { deletePage } from "@/lib/supabase/write";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  try {
    const page = await getPage(auth.brainId, slug);
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const [links, timeline] = await Promise.all([
      getPageLinks(auth.brainId, slug),
      getTimeline(auth.brainId, slug),
    ]);

    return NextResponse.json({ ...page, links, timeline });
  } catch (err) {
    console.error("[brainbase] /api/pages/[slug] GET error:", err);
    return NextResponse.json({ error: "Failed to get page" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  try {
    const deleted = await deletePage(auth.brainId, slug);
    return NextResponse.json({ success: deleted, slug });
  } catch (err) {
    console.error("[brainbase] /api/pages/[slug] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete page" }, { status: 500 });
  }
}
