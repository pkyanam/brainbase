/**
 * POST /api/provision — zero-friction brain provisioning.
 *
 * No Clerk, no signup, no email verification. Designed so an AI agent can
 * curl this endpoint and get a working brain in under 3 seconds.
 *
 * Body (all optional):
 *   { name?: string, agent?: string, email?: string }
 *
 * Response:
 *   {
 *     brain_id: "...",
 *     url: "https://brainbase.belweave.ai/api",
 *     api_key: "bb_live_...",      // shown ONCE, never retrievable
 *     mcp_url: "https://brainbase.belweave.ai/api/mcp",
 *     dashboard: "https://brainbase.belweave.ai/dashboard",
 *     created_at: "...",
 *     endpoints: { ... }
 *   }
 *
 * Rate limited to 5 requests / minute / IP and 30 / hour / IP.
 *
 * The "owner" is a synthetic `agent_<uuid>` identity — agents can later claim
 * their brain by linking it to a Clerk account from /apply.
 */

import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db-setup";
import { query, queryOne } from "@/lib/supabase/client";
import { createApiKey } from "@/lib/api-keys";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

interface CreatedBrain {
  id: string;
  slug: string;
  owner_user_id: string;
  created_at: string;
}

function publicBaseUrl(req: NextRequest): string {
  const env =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (env) return env.replace(/\/$/, "");
  // Fall back to whatever the caller hit
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function shortId(): string {
  // 12-char URL-safe random — enough entropy, short enough to type
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  const minute = rateLimit(`provision:min:${ip}`, 5, 60_000);
  if (!minute.allowed) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", scope: "minute", retry_after_seconds: Math.ceil((minute.resetAt - Date.now()) / 1000) },
      { status: 429 }
    );
  }
  const hour = rateLimit(`provision:hr:${ip}`, 30, 3_600_000);
  if (!hour.allowed) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", scope: "hour", retry_after_seconds: Math.ceil((hour.resetAt - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  let body: { name?: string; agent?: string; email?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }

  const ownerId = `agent_${shortId()}`;
  const name = (body.name && body.name.slice(0, 80)) || "Agent Brain";
  const slug = shortId();

  await ensureSchema();

  let brain: CreatedBrain | null = null;
  try {
    brain = await queryOne<CreatedBrain>(
      `INSERT INTO brains (owner_user_id, name, slug)
       VALUES ($1, $2, $3)
       RETURNING id::text, slug, owner_user_id, created_at::text`,
      [ownerId, name, slug]
    );
  } catch (err: any) {
    console.error("[brainbase] provision: brain insert failed:", err?.message);
    return NextResponse.json({ error: "failed_to_create_brain" }, { status: 500 });
  }
  if (!brain) {
    return NextResponse.json({ error: "failed_to_create_brain" }, { status: 500 });
  }

  let rawKey: string;
  try {
    const created = await createApiKey(ownerId, brain.id, body.agent || "default");
    rawKey = created.rawKey;
  } catch (err: any) {
    console.error("[brainbase] provision: key creation failed:", err?.message);
    // Roll back the brain — key is mandatory for the brain to be usable.
    await query(`DELETE FROM brains WHERE id = $1`, [brain.id]).catch(() => {});
    return NextResponse.json({ error: "failed_to_create_key" }, { status: 500 });
  }

  // Optional: provision the Neo4j projection up-front so the first traversal
  // call doesn't pay the cold-init cost. Best-effort — a Neo4j outage MUST NOT
  // fail the provisioning call.
  if (process.env.NEO4J_URI) {
    try {
      const { provisionBrain } = await import("@/lib/neo4j/engine");
      await provisionBrain(brain.id);
    } catch (err: any) {
      console.warn("[brainbase] provision: Neo4j init skipped:", err?.message);
    }
  }

  const base = publicBaseUrl(req);
  return NextResponse.json(
    {
      brain_id: brain.id,
      slug: brain.slug,
      name,
      api_key: rawKey,
      url: `${base}/api`,
      mcp_url: `${base}/api/mcp`,
      dashboard: `${base}/dashboard`,
      wiki_url: `${base}/b/${brain.slug}`,
      created_at: brain.created_at,
      endpoints: {
        search: `${base}/api/brain/search`,
        graph: `${base}/api/brain/graph`,
        traverse: `${base}/api/brain/traverse`,
        page: `${base}/api/brain/page`,
        stats: `${base}/api/brain/stats`,
        mcp: `${base}/api/mcp`,
      },
      docs: `${base}/docs`,
    },
    {
      status: 201,
      headers: {
        "X-RateLimit-Remaining-Minute": String(minute.remaining),
        "X-RateLimit-Remaining-Hour": String(hour.remaining),
      },
    }
  );
}

/** GET returns provisioning info / pricing without creating a brain. */
export async function GET(req: NextRequest) {
  const base = publicBaseUrl(req);
  return NextResponse.json({
    name: "Brainbase",
    description: "Memory layer for AI agents. One POST and you're in.",
    install_url: `${base}/api/provision/install`,
    one_liner: `curl -fsSL ${base}/api/provision/install | sh`,
    rate_limits: { per_minute: 5, per_hour: 30 },
    docs: `${base}/docs`,
  });
}
