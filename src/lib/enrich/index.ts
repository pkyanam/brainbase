/**
 * Enrichment Pipeline Orchestrator
 *
 * GBrain parity: 7-step enrichment protocol adapted for Brainbase.
 *
 * Steps:
 *   1. Resolve entity (check brain, determine type and notability)
 *   2. Fetch external data (LLM for now, pluggable sources)
 *   3. Generate structured page content (person/company template)
 *   4. Write page to brain (putPage)
 *   5. Store raw data (putRawData — provenance)
 *   6. Apply suggested tags
 *   7. Cross-reference detected entities (create links)
 */

import { resolveEntity, suggestSlug } from "./resolve";
import { fetchFromOpenAI } from "./sources";
import { buildPersonPage, buildCompanyPage } from "./templates";
import { putPage, addLink } from "../supabase/write";
import { putRawData } from "../supabase/raw-data";
import { addTag } from "../supabase/tags";
import { logActivity } from "../activity";
import type { EnrichRequest, EnrichResult, EnrichEntityType, EnrichTier } from "./types";

/**
 * Main enrichment entry point.
 *
 * Called by the Vercel endpoint (synchronous for Tiers 2-3)
 * or by the minion worker (async for Tier 1).
 */
export async function enrichEntity(
  brainId: string,
  userId: string,
  request: EnrichRequest
): Promise<EnrichResult> {
  const tier: EnrichTier = request.tier || 2;
  const entityType: EnrichEntityType | "auto" = request.type || "auto";

  // ── Step 1: Resolve entity ──────────────────────────────────────────
  const resolution = await resolveEntity(brainId, request.name, entityType);

  const detectedType: EnrichEntityType =
    resolution.detectedType || (entityType === "auto" ? "person" : entityType);

  // Skip if recently enriched (within 7 days) and not forced
  if (
    resolution.exists &&
    !request.force &&
    resolution.updatedAt &&
    isRecent(resolution.updatedAt, 7)
  ) {
    return {
      slug: resolution.slug!,
      title: resolution.title!,
      type: resolution.type!,
      action: "skipped",
      compiledTruth: resolution.content || "",
      sources: [],
      newSignals: [],
      enrichedAt: new Date().toISOString(),
      linksCreated: 0,
      rawDataStored: 0,
    };
  }

  // ── Step 2: Fetch external data ─────────────────────────────────────
  const sourceData = await fetchFromOpenAI(
    request.name,
    detectedType,
    tier,
    request.context
  );

  // ── Step 3: Generate structured page content ────────────────────────
  const template =
    detectedType === "company"
      ? buildCompanyPage(request.name, sourceData.content, request.context)
      : buildPersonPage(request.name, sourceData.content, request.context);

  // ── Step 4: Write page to brain ─────────────────────────────────────
  const slug = resolution.exists
    ? resolution.slug!
    : suggestSlug(request.name, detectedType);

  const page = await putPage(brainId, {
    slug,
    title: template.title,
    type: detectedType,
    content: template.content,
    frontmatter: {},
    written_by: userId,
  });

  await logActivity({
    brainId,
    actorUserId: userId,
    action: resolution.exists ? "page_updated" : "page_created",
    entityType: "page",
    entitySlug: slug,
    metadata: {
      enriched_by: "enrich-pipeline",
      tier,
      source: "openai",
    },
  });

  // ── Step 5: Store raw data (provenance) ─────────────────────────────
  await putRawData(brainId, slug, "openai", {
    prompt: { name: request.name, type: detectedType, tier },
    raw: sourceData.content,
    meta: sourceData.meta,
  });

  // ── Step 6: Apply suggested tags ────────────────────────────────────
  for (const tag of template.tags) {
    try {
      await addTag(brainId, slug, tag);
    } catch {
      // Tag already exists or page not found — non-fatal
    }
  }

  // ── Step 7: Cross-reference detected entities ───────────────────────
  let linksCreated = 0;
  for (const entityName of template.detectedEntities.slice(0, 10)) {
    const targetResolution = await resolveEntity(brainId, entityName, "auto");
    if (targetResolution.exists && targetResolution.slug) {
      try {
        const ok = await addLink(
          brainId,
          slug,
          targetResolution.slug,
          "mentions",
          userId
        );
        if (ok) linksCreated++;
      } catch {
        // Link may already exist — non-fatal
      }
    }
  }

  return {
    slug,
    title: template.title,
    type: detectedType,
    action: resolution.exists ? "updated" : "created",
    compiledTruth: template.content,
    sources: ["openai"],
    newSignals: [
      `Enriched via OpenAI (${sourceData.meta?.model}, tier ${tier})`,
      ...template.detectedEntities.slice(0, 5).map((e) => `Detected entity: ${e}`),
    ],
    enrichedAt: new Date().toISOString(),
    linksCreated,
    rawDataStored: 1,
  };
}

function isRecent(isoDate: string, days: number): boolean {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  return (now - then) < days * 24 * 60 * 60 * 1000;
}
