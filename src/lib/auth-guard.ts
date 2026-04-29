import { auth } from "@clerk/nextjs/server";
import { queryOne } from "./supabase/client";
import { getOrCreateBrainForUser } from "./brain-context";
import { NextResponse } from "next/server";

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
 * Lightweight auth check — just verifies the user is logged in.
 */
export async function requireAuth(): Promise<string | NextResponse> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return userId;
}
