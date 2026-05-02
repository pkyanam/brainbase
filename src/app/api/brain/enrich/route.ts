/**
 * POST /api/brain/enrich
 *
 * Entity enrichment — gives your brain rich, structured pages for people
 * and companies. Uses the same tiered protocol as GBrain.
 *
 * Auth: Bearer token (bb_live_*) OR Clerk session OR Convex service secret.
 *
 * Body:
 *   { name: string, type?: "person"|"company"|"auto", tier?: 1|2|3,
 *     context?: string, force?: boolean, async?: boolean }
 *
 * Tier 1 (full): Deep research, 12+ sections — processed asynchronously via minion job.
 * Tier 2 (moderate): Core sections — processed synchronously, returns result immediately.
 * Tier 3 (light): State + summary only — fastest, synchronous.
 *
 * Returns: { slug, title, type, action, compiledTruth, sources, newSignals, linksCreated } or { queued: true, jobId }
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { enrichEntity } from "@/lib/enrich";
import { submitJob } from "@/lib/minions/queue";
import { ensureRawDataSchema, ensureTagsColumn } from "@/lib/db-setup";
import type { EnrichRequest, EnrichTier } from "@/lib/enrich/types";

// Configured tiers that must run async (because they exceed Vercel's 10s limit)
const ASYNC_TIERS: EnrichTier[] = [1];

export async function POST(req: NextRequest) {
  // Idempotent schema init — ensures tables exist regardless of auth path
  await ensureRawDataSchema();
  await ensureTagsColumn();

  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: EnrichRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { error: "Missing or invalid 'name' field" },
      { status: 400 }
    );
  }

  // Validate type
  if (body.type && !["person", "company", "auto"].includes(body.type)) {
    return NextResponse.json(
      { error: "Invalid 'type' — must be 'person', 'company', or 'auto'" },
      { status: 400 }
    );
  }

  // Validate tier
  if (body.tier && ![1, 2, 3].includes(body.tier)) {
    return NextResponse.json(
      { error: "Invalid 'tier' — must be 1, 2, or 3" },
      { status: 400 }
    );
  }

  const tier: EnrichTier = body.tier || 2;
  const shouldQueue = body.async === true || ASYNC_TIERS.includes(tier);

  // Async path — queue as minion job
  if (shouldQueue) {
    try {
      const job = await submitJob("enrich_entity", {
        brain_id: auth.brainId,
        data: {
          name: body.name.trim(),
          type: body.type || "auto",
          tier,
          context: body.context,
          force: body.force,
          userId: auth.userId,
        },
        priority: tier === 1 ? 0 : 2, // Tier 1 = highest priority
        timeout_ms: 60_000,
      });

      return NextResponse.json({
        queued: true,
        jobId: job.id,
        tier,
        message: `Enrichment queued as job #${job.id}. Check /api/jobs/${job.id} for status.`,
      });
    } catch (err) {
      console.error("[brainbase] Failed to queue enrich job:", err);
      return NextResponse.json(
        { error: "Failed to queue enrichment job" },
        { status: 500 }
      );
    }
  }

  // Sync path — process immediately
  try {
    const result = await enrichEntity(auth.brainId, auth.userId, {
      name: body.name.trim(),
      type: body.type || "auto",
      tier,
      context: body.context,
      force: body.force,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[brainbase] Enrich error:", err);
    const message = err instanceof Error ? err.message : "Enrichment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
