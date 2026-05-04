/**
 * GET /api/brain/export — full brain dump as JSON.
 *
 * Format (versioned for future migrations):
 *   {
 *     "format": "brainbase.v1",
 *     "exported_at": "...",
 *     "brain": { id, name, slug, ... },
 *     "pages":     [{ slug, title, type, content, frontmatter, tags, written_by, public, created_at, updated_at }],
 *     "links":     [{ from_slug, to_slug, link_type, context, written_by }],
 *     "timeline":  [{ slug, date, summary, detail, source, written_by }]
 *   }
 *
 * "Your data is yours" — this is the round-trip baseline. The matching
 * importer at POST /api/brain/import accepts the same shape.
 *
 * Owner-only. Streamed via JSON (no chunking yet — fine for tens of thousands
 * of pages; revisit when a single brain crosses ~50MB).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { queryMany, queryOne } from "@/lib/supabase/client";

interface BrainHeader {
  id: string;
  name: string;
  slug: string;
  wiki_enabled: boolean;
  wiki_title: string | null;
  wiki_tagline: string | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.isOwner) {
    return NextResponse.json({ error: "owner_required" }, { status: 403 });
  }

  const brain = await queryOne<BrainHeader>(
    `SELECT id::text, name, slug, wiki_enabled,
            wiki_title, wiki_tagline, created_at::text
     FROM brains WHERE id = $1`,
    [auth.brainId]
  );
  if (!brain) {
    return NextResponse.json({ error: "brain_not_found" }, { status: 404 });
  }

  const pages = await queryMany(
    `SELECT slug, title, COALESCE(type,'unknown') AS type,
            COALESCE(compiled_truth,'') AS content,
            COALESCE(frontmatter,'{}'::jsonb) AS frontmatter,
            tags, written_by,
            COALESCE(public, FALSE) AS public,
            created_at::text, updated_at::text
     FROM pages
     WHERE brain_id = $1
     ORDER BY slug`,
    [auth.brainId]
  );

  const links = await queryMany(
    `SELECT fp.slug AS from_slug, tp.slug AS to_slug,
            COALESCE(l.link_type,'related') AS link_type,
            COALESCE(l.context,'') AS context,
            l.written_by
     FROM links l
     JOIN pages fp ON fp.id = l.from_page_id AND fp.brain_id = l.brain_id
     JOIN pages tp ON tp.id = l.to_page_id   AND tp.brain_id = l.brain_id
     WHERE l.brain_id = $1
     ORDER BY fp.slug, tp.slug`,
    [auth.brainId]
  );

  const timeline = await queryMany(
    `SELECT p.slug, t.date::text, t.summary,
            t.detail, t.source, t.written_by
     FROM timeline_entries t
     JOIN pages p ON p.id = t.page_id AND p.brain_id = t.brain_id
     WHERE t.brain_id = $1
     ORDER BY p.slug, t.date DESC`,
    [auth.brainId]
  );

  const filename = `brainbase-${brain.slug || auth.brainId}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(
    JSON.stringify(
      {
        format: "brainbase.v1",
        exported_at: new Date().toISOString(),
        brain: {
          name: brain.name,
          slug: brain.slug,
          wiki_enabled: brain.wiki_enabled,
          wiki_title: brain.wiki_title,
          wiki_tagline: brain.wiki_tagline,
          created_at: brain.created_at,
        },
        counts: { pages: pages.length, links: links.length, timeline: timeline.length },
        pages,
        links,
        timeline,
      },
      null,
      2
    ),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    }
  );
}
