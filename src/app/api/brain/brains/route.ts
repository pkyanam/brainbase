import { NextRequest, NextResponse } from "next/server";
import { requireAuth, listUserBrains } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const userId = await requireAuth();
  if (typeof userId !== "string") return userId;

  const brains = await listUserBrains(userId);
  return NextResponse.json({ brains });
}
