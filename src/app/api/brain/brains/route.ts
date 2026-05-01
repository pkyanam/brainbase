import { NextRequest, NextResponse } from "next/server";
import { requireAuth, listUserBrains } from "@/lib/auth-guard";
import { deleteBrain } from "@/lib/brain-context";

export async function GET(req: NextRequest) {
  const userId = await requireAuth();
  if (typeof userId !== "string") return userId;

  const brains = await listUserBrains(userId);
  return NextResponse.json({ brains });
}

export async function DELETE(req: NextRequest) {
  const userId = await requireAuth();
  if (typeof userId !== "string") return userId;

  const { searchParams } = new URL(req.url);
  const brainId = searchParams.get("brain_id");
  if (!brainId) {
    return NextResponse.json({ error: "Missing brain_id" }, { status: 400 });
  }

  try {
    const success = await deleteBrain(brainId, userId);
    if (!success) {
      return NextResponse.json({ error: "Forbidden — only owners can delete" }, { status: 403 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[brainbase] Failed to delete brain:", err);
    return NextResponse.json({ error: "Failed to delete brain" }, { status: 500 });
  }
}
