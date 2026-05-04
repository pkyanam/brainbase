/**
 * GET /api/wiki/<username>/page/<...slug>
 * Anonymous public read. Returns 404 if either:
 *   - the wiki isn't enabled,
 *   - or the page isn't flagged public.
 *
 * Body includes the page, its public outgoing links, public backlinks,
 * and timeline. Designed so any agent can curl a brain's public knowledge.
 */

import { NextResponse } from "next/server";
import {
  loadWikiBrain,
  loadWikiPage,
  loadWikiPageLinks,
  loadWikiTimeline,
} from "@/lib/wiki";

type Params = { username: string; slug: string[] };

export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> }
) {
  const { username, slug } = await params;
  const pageSlug = slug.join("/");

  const brain = await loadWikiBrain(username);
  if (!brain) {
    return NextResponse.json({ error: "wiki_not_found" }, { status: 404 });
  }

  const page = await loadWikiPage(username, pageSlug);
  if (!page) {
    return NextResponse.json({ error: "page_not_found_or_private" }, { status: 404 });
  }

  const [links, timeline] = await Promise.all([
    loadWikiPageLinks(brain.id, pageSlug),
    loadWikiTimeline(brain.id, pageSlug),
  ]);

  return NextResponse.json({
    brain: { slug: brain.slug, name: brain.name },
    page,
    links,
    timeline,
  });
}
