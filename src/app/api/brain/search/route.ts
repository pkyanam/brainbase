import { NextRequest, NextResponse } from "next/server";
import { searchBrain } from "@/lib/supabase/search";
import { requireOwner } from "@/lib/auth-guard";
import { requireQuota } from "@/lib/usage";

export async function GET(request: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  const q = request.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json(
      { error: "Missing query parameter 'q'" },
      { status: 400 }
    );
  }

  // Rate limit check
  const quotaCheck = await requireQuota(auth.brainId, "search");
  if (quotaCheck) return quotaCheck;

  try {
    const results = await searchBrain(auth.brainId, q);
    return NextResponse.json(results);
  } catch (err) {
    console.error("[brainbase] Search error:", err);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
