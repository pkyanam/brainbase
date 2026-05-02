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

import { resolveEntity, suggestSlug, detectEntityType } from "./resolve";
import { fetchFromBrave, formatWithOpenAI } from "./sources";
import { buildPersonPage, buildCompanyPage } from "./templates";
import { putPage, addLink, deletePage } from "../supabase/write";
import { putRawData } from "../supabase/raw-data";
import { addTag } from "../supabase/tags";
import { logActivity } from "../activity";
import type { EnrichRequest, EnrichResult, EnrichEntityType, EnrichTier } from "./types";
import { TIER_CONFIGS } from "./types";

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
    resolution.detectedType ||
    (entityType === "auto" ? detectEntityType(request.name) : entityType);

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

  // ── Compute slug early (needed for raw data storage) ────────────────
  const slug = resolution.exists
    ? resolution.slug!
    : suggestSlug(request.name, detectedType);

  // ── Step 2: Fetch external data ─────────────────────────────────────
  const config = TIER_CONFIGS[tier];
  const useWebSearch = config.externalSources.includes("brave");

  // Phase 2a: Web research via Brave (Tiers 1-2)
  let researchData: string | null = null;
  const allSources: string[] = [];
  let rawDataStored = 0;

  if (useWebSearch) {
    const brave = await fetchFromBrave(request.name, detectedType, tier, request.context);
    if (brave) {
      researchData = brave.content;
      allSources.push("brave");
      await putRawData(brainId, slug, "brave", {
        prompt: { name: request.name, type: detectedType, tier },
        raw: brave.content,
        meta: brave.meta,
      });
      rawDataStored++;
    }
  }

  // Phase 2b: Format with OpenAI (all tiers)
  const formatted = await formatWithOpenAI(
    request.name,
    detectedType,
    tier,
    researchData,
    request.context
  );
  allSources.push("openai");

  // ── Step 3: Generate structured page content ────────────────────────
  const template =
    detectedType === "company"
      ? buildCompanyPage(request.name, formatted.content, request.context)
      : buildPersonPage(request.name, formatted.content, request.context);

  // ── Step 4: Write page to brain ─────────────────────────────────────
  const isNew = !resolution.exists;

  const page = await putPage(brainId, {
    slug,
    title: template.title,
    type: detectedType,
    content: template.content,
    frontmatter: {},
    written_by: userId,
  });

  // ── Steps 5-7: Post-write operations (wrapped for rollback) ─────────
  let linksCreated = 0;
  try {
    await logActivity({
      brainId,
      actorUserId: userId,
      action: isNew ? "page_created" : "page_updated",
      entityType: "page",
      entitySlug: slug,
      metadata: {
        enriched_by: "enrich-pipeline",
        tier,
        sources: allSources.join(","),
      },
    });

    // Step 5: Store raw data (provenance) — OpenAI formatted output
    await putRawData(brainId, slug, "openai", {
      prompt: { name: request.name, type: detectedType, tier },
      raw: formatted.content,
      meta: formatted.meta,
    });
    rawDataStored++;

    // Step 6: Apply suggested tags
    for (const tag of template.tags) {
      try {
        await addTag(brainId, slug, tag);
      } catch {
        // Tag already exists or page not found — non-fatal
      }
    }

    // Step 7: Cross-reference detected entities
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
  } catch (postErr) {
    // Rollback: if the page was newly created and post-write ops failed,
    // delete the orphan page to avoid leaving incomplete data.
    console.error("[enrich] Post-write operations failed:", postErr);
    if (isNew) {
      try {
        await deletePage(brainId, slug);
        console.error(`[enrich] Rolled back orphan page: ${slug}`);
      } catch (rollbackErr) {
        console.error(`[enrich] Rollback failed for ${slug}:`, rollbackErr);
      }
    }
    throw postErr;
  }

  return {
    slug,
    title: template.title,
    type: detectedType,
    action: resolution.exists ? "updated" : "created",
    compiledTruth: template.content,
    sources: allSources,
    newSignals: [
      `Enriched via ${allSources.join(" + ")} (tier ${tier}, ${formatted.meta?.model})`,
      researchData ? "Web research data included" : "LLM knowledge only",
      ...template.detectedEntities.slice(0, 5).map((e) => `Detected entity: ${e}`),
    ],
    enrichedAt: new Date().toISOString(),
    linksCreated,
    rawDataStored,
  };
}

function isRecent(isoDate: string, days: number): boolean {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  return (now - then) < days * 24 * 60 * 60 * 1000;
}
