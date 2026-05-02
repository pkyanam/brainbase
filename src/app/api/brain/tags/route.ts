import { NextRequest, NextResponse } from "next/server";
import { addTag, removeTag, setTags, getTags, listTags, findPagesByTag } from "@/lib/supabase/tags";
import { resolveApiAuth } from "@/lib/api-auth";

/**
 * Tag Management API — categorize and filter brain pages.
 *
 * Auth: Bearer token (bb_live_*) OR Clerk session cookie OR Convex service secret.
 *
 * GET  /api/brain/tags?slug=<slug>      → tags for a page
 * GET  /api/brain/tags?list=true         → all tags with usage counts
 * GET  /api/brain/tags?find=<tag>        → pages matching a tag
 * POST /api/brain/tags                   → { slug, tag, action: "add"|"remove" }
 * PUT  /api/brain/tags                   → { slug, tags: [...] }
 */
export async function GET(req: NextRequest) {
  const auth = await resolveApiAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const list = searchParams.get("list");
  const find = searchParams.get("find");

  try {
    if (list === "true") {
      const tags = await listTags(auth.brainId);
      return NextResponse.json({ tags });
    }

    if (find) {
      const pages = await findPagesByTag(auth.brainId, find);
      return NextResponse.json({ pages });
    }

    if (slug) {
      const tags = await getTags(auth.brainId, slug);
      return NextResponse.json({ slug, tags });
    }

    return NextResponse.json({ error: "Provide slug, list=true, or find=<tag>" }, { status: 400 });
  } catch (err) {
    console.error("[brainbase] Get tags error:", err);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await resolveApiAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { slug?: string; tag?: string; action?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.slug) return NextResponse.json({ error: "Missing 'slug'" }, { status: 400 });
  if (!body.tag) return NextResponse.json({ error: "Missing 'tag'" }, { status: 400 });
  if (!body.action || !["add", "remove"].includes(body.action)) {
    return NextResponse.json({ error: "Missing or invalid 'action' (must be 'add' or 'remove')" }, { status: 400 });
  }

  try {
    const tags = body.action === "add"
      ? await addTag(auth.brainId, body.slug, body.tag)
      : await removeTag(auth.brainId, body.slug, body.tag);
    return NextResponse.json({ success: true, slug: body.slug, tags });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update tags";
    const status = message.includes("not found") ? 404 : 500;
    console.error("[brainbase] Tag update error:", err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await resolveApiAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { slug?: string; tags?: string[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.slug) return NextResponse.json({ error: "Missing 'slug'" }, { status: 400 });
  if (!Array.isArray(body.tags)) return NextResponse.json({ error: "Missing 'tags' array" }, { status: 400 });

  try {
    const tags = await setTags(auth.brainId, body.slug, body.tags);
    return NextResponse.json({ success: true, slug: body.slug, tags });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to set tags";
    const status = message.includes("not found") ? 404 : 500;
    console.error("[brainbase] Set tags error:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
