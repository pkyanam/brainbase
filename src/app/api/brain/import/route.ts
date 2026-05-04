/**
 * POST /api/brain/import — bulk import a brain dump into the current brain.
 *
 * Accepts the format produced by /api/brain/export (`brainbase.v1`).
 *
 * Modes:
 *   - "merge"   (default): upsert pages by slug, idempotent. Existing pages
 *                are updated; missing pages are inserted; nothing is deleted.
 *   - "replace": ⚠️ wipes the destination brain before importing. Owner-confirmed.
 *
 * Imports are wrapped in a transaction. On failure, nothing partial lands.
 *
 * Owner-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { getPool } from "@/lib/supabase/client";

interface ImportPayload {
  format?: string;
  pages?: ImportedPage[];
  links?: ImportedLink[];
  timeline?: ImportedTimeline[];
  mode?: "merge" | "replace";
}

interface ImportedPage {
  slug: string;
  title: string;
  type?: string;
  content?: string;
  frontmatter?: Record<string, unknown>;
  tags?: string[] | null;
  written_by?: string | null;
  public?: boolean;
}

interface ImportedLink {
  from_slug: string;
  to_slug: string;
  link_type?: string;
  context?: string | null;
  written_by?: string | null;
}

interface ImportedTimeline {
  slug: string;
  date: string;
  summary: string;
  detail?: string | null;
  source?: string | null;
  written_by?: string | null;
}

export async function POST(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.isOwner) {
    return NextResponse.json({ error: "owner_required" }, { status: 403 });
  }

  let body: ImportPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.format && body.format !== "brainbase.v1") {
    return NextResponse.json(
      { error: "unsupported_format", got: body.format, expected: "brainbase.v1" },
      { status: 400 }
    );
  }

  const mode = body.mode === "replace" ? "replace" : "merge";
  const pages = Array.isArray(body.pages) ? body.pages : [];
  const links = Array.isArray(body.links) ? body.links : [];
  const timeline = Array.isArray(body.timeline) ? body.timeline : [];

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (mode === "replace") {
      // Order matters: timeline → links → pages (FK chain).
      await client.query(`DELETE FROM timeline_entries WHERE brain_id = $1`, [auth.brainId]);
      await client.query(`DELETE FROM links             WHERE brain_id = $1`, [auth.brainId]);
      await client.query(`DELETE FROM pages             WHERE brain_id = $1`, [auth.brainId]);
    }

    let pagesUpserted = 0;
    for (const p of pages) {
      if (!p.slug || !p.title) continue;
      await client.query(
        `INSERT INTO pages
           (brain_id, slug, title, type, compiled_truth, frontmatter,
            tags, written_by, public, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, COALESCE($9, FALSE), NOW(), NOW())
         ON CONFLICT (brain_id, slug) DO UPDATE SET
           title = EXCLUDED.title,
           type = EXCLUDED.type,
           compiled_truth = EXCLUDED.compiled_truth,
           frontmatter = EXCLUDED.frontmatter,
           tags = EXCLUDED.tags,
           written_by = COALESCE(EXCLUDED.written_by, pages.written_by),
           public = EXCLUDED.public,
           updated_at = NOW()`,
        [
          auth.brainId,
          p.slug,
          p.title,
          p.type || "unknown",
          p.content || "",
          JSON.stringify(p.frontmatter || {}),
          p.tags ?? null,
          p.written_by ?? null,
          !!p.public,
        ]
      );
      pagesUpserted++;
    }

    let linksUpserted = 0;
    for (const l of links) {
      if (!l.from_slug || !l.to_slug) continue;
      // Resolve slugs → page ids inside the same brain
      const fromIdRow = await client.query(
        `SELECT id FROM pages WHERE brain_id = $1 AND slug = $2`,
        [auth.brainId, l.from_slug]
      );
      const toIdRow = await client.query(
        `SELECT id FROM pages WHERE brain_id = $1 AND slug = $2`,
        [auth.brainId, l.to_slug]
      );
      if (fromIdRow.rowCount === 0 || toIdRow.rowCount === 0) continue;
      await client.query(
        `INSERT INTO links (brain_id, from_page_id, to_page_id, link_type, context, written_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [
          auth.brainId,
          fromIdRow.rows[0].id,
          toIdRow.rows[0].id,
          l.link_type || "related",
          l.context ?? null,
          l.written_by ?? null,
        ]
      );
      linksUpserted++;
    }

    let timelineUpserted = 0;
    for (const t of timeline) {
      if (!t.slug || !t.date || !t.summary) continue;
      const pageRow = await client.query(
        `SELECT id FROM pages WHERE brain_id = $1 AND slug = $2`,
        [auth.brainId, t.slug]
      );
      if (pageRow.rowCount === 0) continue;
      await client.query(
        `INSERT INTO timeline_entries
           (brain_id, page_id, date, summary, detail, source, written_by)
         VALUES ($1, $2, $3::date, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [
          auth.brainId,
          pageRow.rows[0].id,
          t.date,
          t.summary,
          t.detail ?? null,
          t.source ?? null,
          t.written_by ?? null,
        ]
      );
      timelineUpserted++;
    }

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      mode,
      counts: {
        pages_upserted: pagesUpserted,
        links_upserted: linksUpserted,
        timeline_upserted: timelineUpserted,
      },
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[brainbase] import failed:", err?.message);
    return NextResponse.json(
      { error: "import_failed", message: String(err?.message ?? err) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
