import { NextRequest, NextResponse } from "next/server";
import { getPage, getPageLinks, getTimeline } from "@/lib/supabase/pages";
import { putPage, deletePage } from "@/lib/supabase/write";
import { validateApiKey } from "@/lib/api-keys";
import { requireOwner, requireBrainAccess } from "@/lib/auth-guard";
import { snapshotPageVersion } from "@/lib/page-versions";
import { logActivity } from "@/lib/activity";

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function resolveAuth(req: NextRequest) {
  // Try API key first
  const token = getBearerToken(req);
  if (token) {
    const keyData = await validateApiKey(token);
    if (keyData) return { brainId: keyData.brainId, userId: keyData.userId || "api" };
  }
  // Fall back to Clerk session
  const ctx = await requireOwner();
  if (ctx instanceof Response) return null;
  return { brainId: ctx.brainId, userId: ctx.userId };
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
  const auth = await resolveAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    // Snapshot current version before overwriting
    await snapshotPageVersion(auth.brainId, slug, auth.userId);

    const page = await putPage(auth.brainId, {
      slug,
      title: body.title,
      type: body.type,
      content: body.content,
      frontmatter: body.frontmatter,
    });

    await logActivity({
      brainId: auth.brainId,
      actorUserId: auth.userId,
      action: "page_updated",
      entityType: "page",
      entitySlug: slug,
      metadata: { title: body.title, type: body.type },
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
  const auth = await resolveAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await params;
  const slug = resolved.slug?.join("/") || "";
  if (!slug) {
    return NextResponse.json({ error: "Missing page slug" }, { status: 400 });
  }

  try {
    const deleted = await deletePage(auth.brainId, slug);

    await logActivity({
      brainId: auth.brainId,
      actorUserId: auth.userId,
      action: "page_deleted",
      entityType: "page",
      entitySlug: slug,
    });

    return NextResponse.json({ success: deleted, slug });
  } catch (err) {
    console.error("[brainbase] Delete page error:", err);
    return NextResponse.json({ error: "Failed to delete page" }, { status: 500 });
  }
}
