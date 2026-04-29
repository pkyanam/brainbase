import { NextRequest, NextResponse } from "next/server";
import { listPages } from "@/lib/supabase/write";
import { requireOwner } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || undefined;
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  try {
    const pages = await listPages(auth.brainId, { type, limit, offset });
    return NextResponse.json({ pages, count: pages.length });
  } catch (err) {
    console.error("[brainbase] List pages error:", err);
    return NextResponse.json({ error: "Failed to list pages" }, { status: 500 });
  }
}
