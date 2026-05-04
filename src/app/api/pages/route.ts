import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { listPages, putPage } from "@/lib/supabase/write";
import { searchBrain } from "@/lib/supabase/search";
import { requireQuota } from "@/lib/usage";

export async function GET(req: NextRequest) {
  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || undefined;
  const q = searchParams.get("q") || undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  try {
    if (q) {
      const results = await searchBrain(auth.brainId, q, limit);
      return NextResponse.json({
        results,
        limit,
        offset,
        total: results.length,
      });
    }

    const results = await listPages(auth.brainId, { type, limit, offset });
    return NextResponse.json({
      results,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[brainbase] /api/pages GET error:", err);
    return NextResponse.json({ error: "Failed to list pages" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quotaCheck = await requireQuota(auth.brainId, "page_write");
  if (quotaCheck) return quotaCheck;

  let body: {
    slug?: string;
    title?: string;
    type?: string;
    content?: string;
    frontmatter?: Record<string, unknown>;
    public?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = body.slug;
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Missing 'slug'" }, { status: 400 });
  }
  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "Missing 'title'" }, { status: 400 });
  }

  try {
    const page = await putPage(auth.brainId, {
      slug,
      title: body.title,
      type: body.type,
      content: body.content,
      frontmatter: body.frontmatter,
      public: body.public,
    });

    return NextResponse.json(page);
  } catch (err) {
    console.error("[brainbase] /api/pages POST error:", err);
    return NextResponse.json({ error: "Failed to put page" }, { status: 500 });
  }
}
