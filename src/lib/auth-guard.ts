import { auth } from "@clerk/nextjs/server";
import { getOrCreateBrainForUser, canAccessBrain, getBrainsForUser } from "./brain-context";
import { NextResponse } from "next/server";
import { validateApiKey } from "./api-keys";

const DEV_USER_ID = "dev-user-001";
const isDev = process.env.NODE_ENV === "development";

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    if (userId) return userId;
  } catch {
    // Clerk not configured
  }
  return isDev ? DEV_USER_ID : null;
}

export async function getCurrentUser(): Promise<{ id: string; email?: string | null } | null> {
  try {
    const { userId } = await auth();
    if (!userId) return null;
    return { id: userId };
  } catch {
    // Clerk not configured
  }
  return isDev ? { id: DEV_USER_ID, email: "dev@localhost" } : null;
}

export interface AuthContext {
  userId: string;
  brainId: string;
}

/**
 * Extract Bearer token from Authorization header.
 */
function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

/**
 * Unified auth resolver — tries API key first, then Clerk session.
 * This is what all API routes should use for machine-to-machine access.
 *
 * Supports multi-brain via X-Brain-Id header when using API keys.
 */
export async function resolveAuth(
  req: Request
): Promise<{ userId: string; brainId: string } | null> {
  // 1. Try API key auth
  const token = getBearerToken(req);
  if (token) {
    const keyData = await validateApiKey(token);
    if (keyData) {
      const requestedBrainId = req.headers.get("x-brain-id");
      if (requestedBrainId && requestedBrainId !== keyData.brainId) {
        const access = await canAccessBrain(keyData.userId, requestedBrainId);
        if (!access) return null;
        return { userId: keyData.userId, brainId: requestedBrainId };
      }
      return { userId: keyData.userId, brainId: keyData.brainId };
    }
  }

  // 2. Fall back to Clerk session
  const userId = await getCurrentUserId();
  if (!userId) return null;

  try {
    const brainId = await getOrCreateBrainForUser(userId);
    return { userId, brainId };
  } catch {
    return null;
  }
}

/**
 * Require the current user to be authenticated.
 * Auto-creates a brain for new users (multi-tenant).
 * Returns { userId, brainId } or a 401/403 Response.
 *
 * If OWNER_USER_ID is set, only that user can access (legacy single-tenant mode).
 */
export async function requireOwner(): Promise<AuthContext | NextResponse> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional hard lockdown (legacy single-tenant)
  const envOwner = process.env.OWNER_USER_ID;
  if (envOwner && userId !== envOwner) {
    return NextResponse.json(
      { error: "Forbidden — this brain is private" },
      { status: 403 }
    );
  }

  // Multi-tenant: every user gets their own brain
  try {
    const brainId = await getOrCreateBrainForUser(userId);
    return { userId, brainId };
  } catch (err) {
    console.error("[brainbase] Brain creation error:", err);
    return NextResponse.json(
      { error: "Failed to initialize brain" },
      { status: 500 }
    );
  }
}

/**
 * v0.3 — Require access to a specific brain (owner or member).
 * Reads ?brain_id from query or uses the user's default brain.
 */
export async function requireBrainAccess(
  req: Request
): Promise<{ userId: string; brainId: string; role: string; isOwner: boolean } | NextResponse> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const requestedBrainId = url.searchParams.get("brain_id");

  // If no brain_id specified, use default
  if (!requestedBrainId) {
    try {
      const brainId = await getOrCreateBrainForUser(userId);
      return { userId, brainId, role: "owner", isOwner: true };
    } catch (err) {
      console.error("[brainbase] Brain creation error:", err);
      return NextResponse.json({ error: "Failed to initialize brain" }, { status: 500 });
    }
  }

  // Verify access
  const access = await canAccessBrain(userId, requestedBrainId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden — you don't have access to this brain" }, { status: 403 });
  }

  return {
    userId,
    brainId: requestedBrainId,
    role: access.role,
    isOwner: access.is_owner,
  };
}

/**
 * Lightweight auth check — just verifies the user is logged in.
 */
export async function requireAuth(): Promise<string | NextResponse> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return userId;
}

/**
 * v0.3 — List all brains the user can access.
 */
export async function listUserBrains(userId: string) {
  return getBrainsForUser(userId);
}
