import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createApiKey, listApiKeys, revokeApiKey, getOrCreateBrain } from "@/lib/api-keys";

const DEV_USER_ID = "dev-user-001";
const isDev = process.env.NODE_ENV === "development";

async function getUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    if (userId) return userId;
  } catch {
    // Clerk not configured
  }
  return isDev ? DEV_USER_ID : null;
}

/**
 * GET /api/keys — list active API keys for the current user
 */
export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keys = await listApiKeys(userId);
    return NextResponse.json({ keys });
  } catch (err) {
    console.error("[brainbase] List keys error:", err);
    return NextResponse.json({ error: "Failed to list keys" }, { status: 500 });
  }
}

/**
 * POST /api/keys — create a new API key
 */
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const name = body.name || "Default";

    const brain = await getOrCreateBrain(userId);
    const { rawKey, record } = await createApiKey(userId, brain.id, name);

    return NextResponse.json({
      key: rawKey,
      record: {
        id: record.id,
        brain_id: record.brain_id,
        name: record.name,
        created_at: record.created_at,
      },
    });
  } catch (err) {
    console.error("[brainbase] Create key error:", err);
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}

/**
 * DELETE /api/keys?id=<keyId> — revoke an API key
 */
export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyId = req.nextUrl.searchParams.get("id");
  if (!keyId) {
    return NextResponse.json({ error: "Missing key id" }, { status: 400 });
  }

  try {
    await revokeApiKey(userId, keyId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[brainbase] Revoke key error:", err);
    return NextResponse.json({ error: "Failed to revoke key" }, { status: 500 });
  }
}
