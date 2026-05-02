import { NextRequest, NextResponse } from "next/server";
import { putRawData, getRawData, deleteRawData } from "@/lib/supabase/raw-data";
import { requireBrainAccess } from "@/lib/auth-guard";

/**
 * GET  /api/brain/raw-data?slug=<slug>&source=<source>
 *   - slug: required
 *   - source: optional filter
 *
 * PUT  /api/brain/raw-data
 *   Body: { slug, source, data }
 *
 * DELETE /api/brain/raw-data?slug=<slug>&source=<source>
 *   - source: optional filter
 */
export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const source = searchParams.get("source") || undefined;

  if (!slug) {
    return NextResponse.json(
      { error: "Missing 'slug' query parameter" },
      { status: 400 }
    );
  }

  try {
    const entries = await getRawData(auth.brainId, slug, source);
    return NextResponse.json({ entries });
  } catch (err) {
    console.error("[brainbase] Get raw data error:", err);
    return NextResponse.json(
      { error: "Failed to fetch raw data" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  let body: { slug?: string; source?: string; data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.slug) {
    return NextResponse.json(
      { error: "Missing 'slug'" },
      { status: 400 }
    );
  }
  if (!body.source) {
    return NextResponse.json(
      { error: "Missing 'source'" },
      { status: 400 }
    );
  }
  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json(
      { error: "Missing 'data' object" },
      { status: 400 }
    );
  }

  try {
    const entry = await putRawData(auth.brainId, body.slug, body.source, body.data);
    return NextResponse.json({ success: true, entry });
  } catch (err) {
    console.error("[brainbase] Put raw data error:", err);
    return NextResponse.json(
      { error: "Failed to store raw data" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const source = searchParams.get("source") || undefined;

  if (!slug) {
    return NextResponse.json(
      { error: "Missing 'slug' query parameter" },
      { status: 400 }
    );
  }

  try {
    const deleted = await deleteRawData(auth.brainId, slug, source);
    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    console.error("[brainbase] Delete raw data error:", err);
    return NextResponse.json(
      { error: "Failed to delete raw data" },
      { status: 500 }
    );
  }
}
