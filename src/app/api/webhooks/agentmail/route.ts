import { NextRequest, NextResponse } from "next/server";
import { putPage } from "@/lib/supabase/write";
import { messageToBrainPayload, getMessage } from "@/lib/agentmail";

/**
 * AgentMail webhook endpoint.
 * Receives message.received events and stores emails as brain pages.
 *
 * Webhook payload structure:
 * {
 *   event_type: "message.received",
 *   event_id: "evt_...",
 *   message: { inbox_id, message_id, from_, to, subject, text, preview, ... }
 * }
 */

// Simple webhook verification using a secret token
// AgentMail also supports signature verification — see webhook-verification.mdx
function verifyWebhook(req: NextRequest): boolean {
  const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
  if (!secret) {
    // If no secret configured, accept all (not recommended for production)
    console.warn("[brainbase] AGENTMAIL_WEBHOOK_SECRET not set — accepting webhook without verification");
    return true;
  }
  const auth = req.headers.get("x-webhook-secret");
  return auth === secret;
}

export async function POST(request: NextRequest) {
  if (!verifyWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = payload.event_type as string;
  const eventId = payload.event_id as string;

  console.log(`[brainbase] AgentMail webhook: ${eventType} (${eventId})`);

  // Only process message.received for now
  if (eventType !== "message.received") {
    return NextResponse.json({ acknowledged: true, event_type: eventType, processed: false });
  }

  const message = payload.message as Record<string, unknown>;
  if (!message) {
    return NextResponse.json({ error: "Missing message in payload" }, { status: 400 });
  }

  const inboxId = message.inbox_id as string;
  const messageId = message.message_id as string;

  // If text/html was omitted due to size limit, fetch full message
  let text = message.text as string | undefined;
  if (!text || text.length < 50) {
    try {
      const fullMsg = await getMessage(inboxId, messageId);
      text = fullMsg.text || fullMsg.preview || "";
      message.text = text;
      message.html = fullMsg.html;
    } catch (err) {
      console.error("[brainbase] Failed to fetch full message:", err);
    }
  }

  // Convert to brain page payload
  const fullMsg = { ...message, from_: (message.from_ as string[]) || (message.from as string[]) || ["unknown"] } as any;
  const brainPayload = messageToBrainPayload(fullMsg);

  // Determine brain ID — use inbox_id as brain identifier or look up mapping
  const brainId = process.env.BRAINBASE_DEFAULT_BRAIN_ID || inboxId;

  try {
    const page = await putPage(brainId, {
      slug: brainPayload.slug,
      title: brainPayload.title,
      type: brainPayload.type,
      content: brainPayload.content,
      frontmatter: brainPayload.frontmatter,
    });

    console.log(`[brainbase] Email ingested: ${brainPayload.slug}`);

    return NextResponse.json({
      acknowledged: true,
      event_type: eventType,
      processed: true,
      brain_page: page.slug,
      brain_id: brainId,
    });
  } catch (err) {
    console.error("[brainbase] Failed to ingest email:", err);
    return NextResponse.json(
      { error: "Failed to store email in brain", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "AgentMail webhook endpoint active",
    supported_events: ["message.received"],
    docs: "https://docs.agentmail.to/webhooks-overview",
  });
}
