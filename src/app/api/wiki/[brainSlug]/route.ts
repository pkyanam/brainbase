/**
 * GET /api/wiki/<brainSlug> — list all public pages.
 * Anonymous, no auth. Returns 404 if the wiki isn't enabled.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadWikiBrain, listWikiPages } from "@/lib/wiki";

type Params = { brainSlug: string };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { brainSlug } = await params;
  const brain = await loadWikiBrain(brainSlug);
  if (!brain) {
    return NextResponse.json({ error: "wiki_not_found" }, { status: 404 });
  }

  const type = req.nextUrl.searchParams.get("type") || undefined;
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "200"), 1000);

  const pages = await listWikiPages(brainSlug, { type, limit });

  return NextResponse.json({
    brain: {
      slug: brain.slug,
      name: brain.name,
      title: brain.wiki_title,
      tagline: brain.wiki_tagline,
    },
    page_count: pages.length,
    pages,
  });
}
