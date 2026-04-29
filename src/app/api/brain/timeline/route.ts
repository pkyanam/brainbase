import { NextRequest, NextResponse } from "next/server";
import { addTimelineEntry } from "@/lib/supabase/write";
import { validateApiKey } from "@/lib/api-keys";
import { requireOwner } from "@/lib/auth-guard";
import { canAccessBrain } from "@/lib/brain-context";
import { logActivity } from "@/lib/activity";

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

  let body: { slug?: string; date?: string; summary?: string; detail?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { slug, date, summary, detail, source } = body;
  if (!slug || !date || !summary) {
    return NextResponse.json({ error: "Missing 'slug', 'date', or 'summary'" }, { status: 400 });
  }

  try {
    const result = await addTimelineEntry(auth.brainId, { slug, date, summary, detail, source });

    await logActivity({
      brainId: auth.brainId,
      actorUserId: auth.userId,
      action: "timeline_added",
      entityType: "timeline",
      entitySlug: slug,
      metadata: { date, summary },
    });

    return NextResponse.json({ success: true, id: result.id, slug, date, summary });
  } catch (err) {
    console.error("[brainbase] Add timeline error:", err);
    return NextResponse.json({ error: "Failed to add timeline entry" }, { status: 500 });
  }
}
