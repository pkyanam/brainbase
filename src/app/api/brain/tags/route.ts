import { NextRequest, NextResponse } from "next/server";
import {
  addTag,
  removeTag,
  setTags,
  getTags,
  listTags,
  findPagesByTag,
} from "@/lib/supabase/tags";
import { requireBrainAccess } from "@/lib/auth-guard";

/**
 * Tag Management API
 *
 * GET  /api/brain/tags?slug=<slug>
 *   Returns tags for a specific page.
 *
 * GET  /api/brain/tags?list=true
 *   Returns all unique tags across the brain with usage counts.
 *
 * GET  /api/brain/tags?find=<tag>
 *   Returns pages that have a specific tag.
 *
 * POST /api/brain/tags
 *   Body: { slug, tag, action: "add" | "remove" }
 *   Adds or removes a tag from a page. Returns updated tag list.
 *
 * PUT  /api/brain/tags
 *   Body: { slug, tags: [...] }
 *   Replaces all tags on a page. Returns updated tag list.
 */
export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const list = searchParams.get("list");
  const find = searchParams.get("find");

  try {
    // GET ?list=true — list all tags
    if (list === "true") {
      const tags = await listTags(auth.brainId);
      return NextResponse.json({ tags });
    }

    // GET ?find=tag — find pages by tag
    if (find) {
      const pages = await findPagesByTag(auth.brainId, find);
      return NextResponse.json({ pages });
    }

    // GET ?slug=X — get tags for a page
    if (slug) {
      const tags = await getTags(auth.brainId, slug);
      return NextResponse.json({ slug, tags });
    }

    return NextResponse.json(
      { error: "Provide slug, list=true, or find=<tag>" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[brainbase] Get tags error:", err);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  let body: { slug?: string; tag?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.slug) {
    return NextResponse.json({ error: "Missing 'slug'" }, { status: 400 });
  }
  if (!body.tag) {
    return NextResponse.json({ error: "Missing 'tag'" }, { status: 400 });
  }
  if (!body.action || !["add", "remove"].includes(body.action)) {
    return NextResponse.json(
      { error: "Missing or invalid 'action' (must be 'add' or 'remove')" },
      { status: 400 }
    );
  }

  try {
    const tags =
      body.action === "add"
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
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  let body: { slug?: string; tags?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.slug) {
    return NextResponse.json({ error: "Missing 'slug'" }, { status: 400 });
  }
  if (!Array.isArray(body.tags)) {
    return NextResponse.json(
      { error: "Missing 'tags' array" },
      { status: 400 }
    );
  }

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
