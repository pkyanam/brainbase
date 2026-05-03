/**
 * POST /api/brain/wiki/page — flip a page's public flag.
 * body: { slug: string, public: boolean }
 *
 * The wiki gate has two predicates: brain.wiki_enabled AND page.public.
 * This endpoint flips the page-level one. Use /api/brain/wiki to flip the
 * brain-level one.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { query } from "@/lib/supabase/client";
import { ensureWikiSchema } from "@/lib/db-setup";

export async function POST(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.isOwner) {
    return NextResponse.json({ error: "owner_required" }, { status: 403 });
  }

  let body: { slug?: string; public?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.slug || typeof body.public !== "boolean") {
    return NextResponse.json({ error: "missing_slug_or_public" }, { status: 400 });
  }

  await ensureWikiSchema();

  const result = await query(
    `UPDATE pages SET public = $3, updated_at = NOW()
     WHERE brain_id = $1 AND slug = $2
     RETURNING slug, public`,
    [auth.brainId, body.slug, body.public]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "page_not_found" }, { status: 404 });
  }

  return NextResponse.json({ updated: true, slug: result.rows[0].slug, public: result.rows[0].public });
}
