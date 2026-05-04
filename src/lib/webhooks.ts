/**
 * Webhooks — fan-out brain events to subscriber URLs.
 *
 * Event names (initial set):
 *   - "page.created"
 *   - "page.updated"
 *   - "page.deleted"
 *   - "link.created"
 *   - "link.deleted"
 *   - "timeline.created"
 *   - "dream.completed"
 *
 * Wildcard "*" subscribes to everything.
 *
 * Delivery is best-effort fire-and-forget — we DO NOT block the request that
 * triggered the event. Failures are logged to the webhook row; a future
 * retry queue can read these and back off.
 *
 * Each delivery is signed via HMAC-SHA256 of the body using the webhook's
 * `secret`, with the signature in the `X-Brainbase-Signature` header (format
 * `sha256=<hex>`). Subscribers verify by recomputing the HMAC.
 */

import { createHash, createHmac, randomBytes } from "crypto";
import { query, queryMany } from "./supabase/client";

export type WebhookEvent =
  | "page.created"
  | "page.updated"
  | "page.deleted"
  | "link.created"
  | "link.deleted"
  | "timeline.created"
  | "dream.completed";

interface WebhookRow {
  id: string;
  url: string;
  secret: string;
  events: string[];
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

function isSubscribed(events: string[], event: WebhookEvent): boolean {
  if (!events || events.length === 0) return false;
  if (events.includes("*")) return true;
  return events.includes(event);
}

function sign(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

interface DeliveryResult {
  webhookId: string;
  url: string;
  status: number | null;
  error: string | null;
  durationMs: number;
}

async function deliverOne(
  hook: WebhookRow,
  event: WebhookEvent,
  payload: unknown,
  brainId: string
): Promise<DeliveryResult> {
  const t0 = Date.now();
  const body = JSON.stringify({
    event,
    brain_id: brainId,
    delivered_at: new Date().toISOString(),
    delivery_id: createHash("sha256")
      .update(`${hook.id}:${t0}:${Math.random()}`)
      .digest("hex")
      .slice(0, 16),
    data: payload,
  });
  const signature = sign(hook.secret, body);

  let status: number | null = null;
  let error: string | null = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Brainbase-Event": event,
        "X-Brainbase-Signature": signature,
        "User-Agent": "brainbase-webhooks/1",
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    status = res.status;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (e: any) {
    error = String(e?.message ?? e);
  }

  // Update bookkeeping. Don't throw if this fails — telemetry, not correctness.
  try {
    await query(
      `UPDATE webhooks SET
         last_delivery_at = NOW(),
         last_delivery_status = $1,
         last_delivery_error = $2,
         delivery_count = delivery_count + 1,
         failure_count = failure_count + CASE WHEN $2 IS NOT NULL THEN 1 ELSE 0 END,
         updated_at = NOW()
       WHERE id = $3`,
      [status, error, hook.id]
    );
  } catch {
    /* noop */
  }

  return { webhookId: hook.id, url: hook.url, status, error, durationMs: Date.now() - t0 };
}

/**
 * Fan an event out to all subscribed webhooks for the brain. Returns a promise
 * the caller may `await` if they want delivery telemetry; otherwise it can be
 * ignored — call sites should NOT block on this.
 */
export async function publishEvent(
  brainId: string,
  event: WebhookEvent,
  payload: unknown
): Promise<DeliveryResult[]> {
  let hooks: WebhookRow[];
  try {
    hooks = await queryMany<WebhookRow>(
      `SELECT id::text, url, secret, events
       FROM webhooks
       WHERE brain_id = $1 AND enabled = TRUE`,
      [brainId]
    );
  } catch (e: any) {
    // Schema not yet ensured / table missing — ignore silently. The first
    // call to ensureSchema() will fix this.
    return [];
  }
  const matching = hooks.filter((h) => isSubscribed(h.events, event));
  if (matching.length === 0) return [];

  return Promise.all(matching.map((h) => deliverOne(h, event, payload, brainId)));
}

/** Fire-and-forget convenience — drop the promise so callers can't accidentally
 *  block the request path. Returns immediately. */
export function emitEvent(brainId: string, event: WebhookEvent, payload: unknown): void {
  publishEvent(brainId, event, payload).catch((e) => {
    console.warn(`[brainbase/webhooks] publish failed:`, e?.message);
  });
}
