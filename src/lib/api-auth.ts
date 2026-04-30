import { NextRequest } from "next/server";
import { validateApiKey } from "./api-keys";
import { canAccessBrain, getOrCreateBrainForUser } from "./brain-context";
import { getCurrentUserId } from "./auth-guard";

export async function resolveApiAuth(
  req: NextRequest
): Promise<{ userId: string; brainId: string } | null> {
  // 1. API key auth (Bearer token)
  const authHeader = req.headers.get("authorization");
  const token = authHeader ? authHeader.match(/^Bearer\s+(.+)$/i)?.[1] : null;
  if (token) {
    const keyData = await validateApiKey(token);
    if (keyData) {
      const requestedBrainId = req.headers.get("x-brain-id") || keyData.brainId;
      if (requestedBrainId !== keyData.brainId) {
        const access = await canAccessBrain(keyData.userId, requestedBrainId);
        if (!access) return null;
      }
      return { userId: keyData.userId, brainId: requestedBrainId };
    }
    return null;
  }

  // 2. Clerk session auth
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const url = new URL(req.url);
  const requestedBrainId =
    req.headers.get("x-brain-id") || url.searchParams.get("brain_id");

  if (requestedBrainId) {
    const access = await canAccessBrain(userId, requestedBrainId);
    if (!access) return null;
    return { userId, brainId: requestedBrainId };
  }

  const defaultBrainId = await getOrCreateBrainForUser(userId);
  return { userId, brainId: defaultBrainId };
}
