import { NextRequest, NextResponse } from "next/server";
import { getPage, getPageLinks, getTimeline } from "@/lib/supabase/pages";
import { putPage, deletePage } from "@/lib/supabase/write";
import { validateApiKey } from "@/lib/api-keys";
import { requireOwner } from "@/lib/auth-guard";

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const authCtx = await requireOwner();
  if (authCtx instanceof Response) return authCtx;

  const resolved = await params;
  const rawSlug = resolved.slug?.join("/") || "";

  if (!rawSlug) {
    return NextResponse.json({ error: "Missing page slug" }, { status: 400 });
  }

  try {
    const page = await getPage(authCtx.brainId, rawSlug);
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const [links, timeline] = await Promise.all([
      getPageLinks(authCtx.brainId, rawSlug),
      getTimeline(authCtx.brainId, rawSlug),
    ]);

    return NextResponse.json({ ...page, links, timeline });
  } catch (err) {
    console.error("[brainbase] Page endpoint error:", err);
    return NextResponse.json({ error: "Failed to fetch page" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing Authorization header. Use: Bearer bb_live_..." }, { status: 401 });
  }
  const keyData = await validateApiKey(token);
  if (!keyData) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }

  const resolved = await params;
  const slug = resolved.slug?.join("/") || "";
  if (!slug) {
    return NextResponse.json({ error: "Missing page slug" }, { status: 400 });
  }

  let body: { title?: string; type?: string; content?: string; frontmatter?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.title) {
    return NextResponse.json({ error: "Missing 'title'" }, { status: 400 });
  }

  try {
    const page = await putPage(keyData.brainId, {
      slug,
      title: body.title,
      type: body.type,
      content: body.content,
      frontmatter: body.frontmatter,
    });
    return NextResponse.json({ success: true, page });
  } catch (err) {
    console.error("[brainbase] Put page error:", err);
    return NextResponse.json({ error: "Failed to put page" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing Authorization header. Use: Bearer bb_live_..." }, { status: 401 });
  }
  const keyData = await validateApiKey(token);
  if (!keyData) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }

  const resolved = await params;
  const slug = resolved.slug?.join("/") || "";
  if (!slug) {
    return NextResponse.json({ error: "Missing page slug" }, { status: 400 });
  }

  try {
    const deleted = await deletePage(keyData.brainId, slug);
    return NextResponse.json({ success: deleted, slug });
  } catch (err) {
    console.error("[brainbase] Delete page error:", err);
    return NextResponse.json({ error: "Failed to delete page" }, { status: 500 });
  }
}
