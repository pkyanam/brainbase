import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { listPageVersions, revertPageToVersion } from "@/lib/page-versions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  const { slug } = await params;
  const pageSlug = slug.join("/");

  const versions = await listPageVersions(auth.brainId, pageSlug, 20);
  return NextResponse.json({ versions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  const { slug } = await params;
  const pageSlug = slug.join("/");
  const { version_id } = (await req.json().catch(() => ({}))) as { version_id?: string };

  if (!version_id) {
    return NextResponse.json({ error: "version_id required" }, { status: 400 });
  }

  const result = await revertPageToVersion(auth.brainId, version_id, auth.userId);
  if (!result) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, slug: result.slug, title: result.title });
}
