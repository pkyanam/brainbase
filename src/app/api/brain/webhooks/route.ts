/**
 * Webhook subscriptions for a brain.
 *
 * GET    /api/brain/webhooks               — list this brain's webhooks
 * POST   /api/brain/webhooks               — create one. body: { url, events: string[], description? }
 *                                             returns full record incl. one-time `secret`
 * DELETE /api/brain/webhooks?id=<uuid>     — remove
 *
 * The `secret` is shown ONCE on creation. It's used by subscribers to verify
 * the `X-Brainbase-Signature` HMAC.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { query, queryMany } from "@/lib/supabase/client";
import { ensureWebhooksSchema } from "@/lib/db-setup";
import { generateWebhookSecret } from "@/lib/webhooks";

const VALID_EVENTS = new Set([
  "*",
  "page.created",
  "page.updated",
  "page.deleted",
  "link.created",
  "link.deleted",
  "timeline.created",
  "dream.completed",
]);

interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  description: string | null;
  last_delivery_at: string | null;
  last_delivery_status: number | null;
  last_delivery_error: string | null;
  delivery_count: string;
  failure_count: string;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.isOwner) return NextResponse.json({ error: "owner_required" }, { status: 403 });

  await ensureWebhooksSchema();

  const rows = await queryMany<WebhookRow>(
    `SELECT id::text, url, events, enabled, description,
            last_delivery_at::text, last_delivery_status, last_delivery_error,
            delivery_count::text, failure_count::text, created_at::text
     FROM webhooks
     WHERE brain_id = $1
     ORDER BY created_at DESC`,
    [auth.brainId]
  );

  return NextResponse.json({
    webhooks: rows.map((r) => ({
      ...r,
      delivery_count: Number(r.delivery_count),
      failure_count: Number(r.failure_count),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.isOwner) return NextResponse.json({ error: "owner_required" }, { status: 403 });

  let body: { url?: string; events?: string[]; description?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "missing_url" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(body.url);
  } catch {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json({ error: "url_must_be_http_or_https" }, { status: 400 });
  }
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ error: "missing_events" }, { status: 400 });
  }
  for (const e of body.events) {
    if (!VALID_EVENTS.has(e)) {
      return NextResponse.json({ error: "invalid_event", got: e, valid: Array.from(VALID_EVENTS) }, { status: 400 });
    }
  }

  await ensureWebhooksSchema();
  const secret = generateWebhookSecret();

  const result = await query<{ id: string }>(
    `INSERT INTO webhooks (brain_id, url, secret, events, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id::text`,
    [auth.brainId, body.url, secret, body.events, body.description ?? null]
  );

  return NextResponse.json(
    {
      id: result.rows[0].id,
      url: body.url,
      events: body.events,
      description: body.description ?? null,
      secret, // shown ONCE
      enabled: true,
    },
    { status: 201 }
  );
}

export async function DELETE(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.isOwner) return NextResponse.json({ error: "owner_required" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const result = await query(
    `DELETE FROM webhooks WHERE id = $1 AND brain_id = $2`,
    [id, auth.brainId]
  );
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
