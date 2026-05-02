import type { MinionHandler } from "../types";
import { enrichEntity } from "../../enrich";
import type { EnrichRequest } from "../../enrich/types";

/**
 * Enrich handler — processes queued enrichment jobs.
 *
 * Job data:
 *   { name, type, tier, context, force, userId }
 *
 * Used for Tier 1 enrichments (>10s) and async enrichment requests.
 */
export const enrichHandler: MinionHandler = async (ctx) => {
  const brainId = ctx.brain_id;
  if (!brainId) {
    throw new Error("brain_id required for enrich_entity");
  }

  const data = ctx.data as unknown as EnrichRequest & { userId?: string };
  if (!data.name) {
    throw new Error("Missing 'name' in enrich job data");
  }

  const userId = data.userId || "enrich-worker";

  await ctx.log(`Enriching entity: ${data.name} (tier ${data.tier || 2})`);
  await ctx.updateProgress({
    phase: "enriching",
    entity: data.name,
    tier: data.tier || 2,
  });

  const result = await enrichEntity(brainId, userId, {
    name: data.name,
    type: data.type || "auto",
    tier: (data.tier as 1 | 2 | 3) || 2,
    context: data.context,
    force: data.force,
  });

  await ctx.updateProgress({
    phase: "complete",
    slug: result.slug,
    action: result.action,
    linksCreated: result.linksCreated,
  });

  return {
    slug: result.slug,
    title: result.title,
    type: result.type,
    action: result.action,
    linksCreated: result.linksCreated,
    rawDataStored: result.rawDataStored,
    sources: result.sources,
  };
};
