/**
 * Owner-side wiki controls.
 *
 * GET  /api/brain/wiki                         — current wiki settings + counts
 * POST /api/brain/wiki                         — update wiki settings
 *      body: { enabled?: boolean, title?: string, tagline?: string }
 * POST /api/brain/wiki/page                    — flip a page public/private
 *      body: { slug: string, public: boolean }
 *
 * Auth: requireBrainAccess (owner role enforced inside).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { query, queryOne } from "@/lib/supabase/client";
import { ensureWikiSchema } from "@/lib/db-setup";

interface BrainSettingsRow {
  slug: string;
  name: string;
  wiki_enabled: boolean;
  wiki_title: string | null;
  wiki_tagline: string | null;
  public_pages: string;
  total_pages: string;
}

export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.isOwner) {
    return NextResponse.json({ error: "owner_required" }, { status: 403 });
  }

  await ensureWikiSchema();

  const row = await queryOne<BrainSettingsRow>(
    `SELECT b.slug,
            b.name,
            b.wiki_enabled,
            b.wiki_title,
            b.wiki_tagline,
            (SELECT count(*)::text FROM pages p WHERE p.brain_id = b.id AND p.public = TRUE) AS public_pages,
            (SELECT count(*)::text FROM pages p WHERE p.brain_id = b.id) AS total_pages
     FROM brains b
     WHERE b.id = $1`,
    [auth.brainId]
  );

  if (!row) return NextResponse.json({ error: "brain_not_found" }, { status: 404 });

  return NextResponse.json({
    brain_id: auth.brainId,
    slug: row.slug,
    name: row.name,
    wiki: {
      enabled: row.wiki_enabled,
      title: row.wiki_title,
      tagline: row.wiki_tagline,
      public_url: row.wiki_enabled ? `/b/${row.slug}` : null,
    },
    counts: {
      public: Number(row.public_pages),
      total: Number(row.total_pages),
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.isOwner) {
    return NextResponse.json({ error: "owner_required" }, { status: 403 });
  }

  await ensureWikiSchema();

  let body: { enabled?: boolean; title?: string; tagline?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const updates: string[] = [];
  const params: unknown[] = [auth.brainId];
  if (typeof body.enabled === "boolean") {
    params.push(body.enabled);
    updates.push(`wiki_enabled = $${params.length}`);
  }
  if (typeof body.title === "string") {
    params.push(body.title.slice(0, 200) || null);
    updates.push(`wiki_title = $${params.length}`);
  }
  if (typeof body.tagline === "string") {
    params.push(body.tagline.slice(0, 500) || null);
    updates.push(`wiki_tagline = $${params.length}`);
  }
  if (updates.length === 0) {
    return NextResponse.json({ error: "no_fields_to_update" }, { status: 400 });
  }

  await query(`UPDATE brains SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $1`, params);
  return NextResponse.json({ updated: true });
}
