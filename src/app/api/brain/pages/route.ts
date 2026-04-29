import { NextRequest, NextResponse } from "next/server";
import { getPage } from "@/lib/supabase/pages";
import { requireOwner } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const page = await getPage(auth.brainId, slug);
  if (!page) {
    return NextResponse.json({ error: "page not found" }, { status: 404 });
  }

  return NextResponse.json(page);
}
