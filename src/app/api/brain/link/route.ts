import { NextRequest, NextResponse } from "next/server";
import { addLink, removeLink } from "@/lib/supabase/write";
import { validateApiKey } from "@/lib/api-keys";
import { requireOwner } from "@/lib/auth-guard";
import { canAccessBrain } from "@/lib/brain-context";
import { logActivity } from "@/lib/activity";
import { requireQuota } from "@/lib/usage";

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function resolveAuth(req: NextRequest) {
  const token = getBearerToken(req);
  if (token) {
    const keyData = await validateApiKey(token);
    if (keyData) {
      const requestedBrainId = req.headers.get("x-brain-id");
      if (requestedBrainId && requestedBrainId !== keyData.brainId) {
        const access = await canAccessBrain(keyData.userId, requestedBrainId);
        if (!access) return null;
        return { brainId: requestedBrainId, userId: keyData.userId };
      }
      return { brainId: keyData.brainId, userId: keyData.userId || "api" };
    }
  }
  const ctx = await requireOwner();
  if (ctx instanceof Response) return null;
  return { brainId: ctx.brainId, userId: ctx.userId };
}

export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { from?: string; to?: string; link_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { from, to, link_type } = body;
  if (!from || !to) {
    return NextResponse.json({ error: "Missing 'from' or 'to' slug" }, { status: 400 });
  }

  // Rate limit check
  const quotaCheck = await requireQuota(auth.brainId, "api_call");
  if (quotaCheck) return quotaCheck;

  try {
    const created = await addLink(auth.brainId, from, to, link_type);

    await logActivity({
      brainId: auth.brainId,
      actorUserId: auth.userId,
      action: "link_created",
      entityType: "link",
      entitySlug: `${from} → ${to}`,
      metadata: { from, to, link_type: link_type || "related" },
    });

    return NextResponse.json({ success: created, from, to, link_type: link_type || "related" });
  } catch (err) {
    console.error("[brainbase] Add link error:", err);
    return NextResponse.json({ error: "Failed to add link" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { from?: string; to?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { from, to } = body;
  if (!from || !to) {
    return NextResponse.json({ error: "Missing 'from' or 'to' slug" }, { status: 400 });
  }

  // Rate limit check
  const quotaCheck = await requireQuota(auth.brainId, "api_call");
  if (quotaCheck) return quotaCheck;

  try {
    const removed = await removeLink(auth.brainId, from, to);

    await logActivity({
      brainId: auth.brainId,
      actorUserId: auth.userId,
      action: "link_deleted",
      entityType: "link",
      entitySlug: `${from} → ${to}`,
      metadata: { from, to },
    });

    return NextResponse.json({ success: removed, from, to });
  } catch (err) {
    console.error("[brainbase] Remove link error:", err);
    return NextResponse.json({ error: "Failed to remove link" }, { status: 500 });
  }
}
