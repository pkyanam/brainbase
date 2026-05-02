/**
 * Entity Resolution — check the brain for existing pages and
 * determine whether an entity is notable enough to enrich.
 */

import { queryOne, queryMany } from "../supabase/client";
import type { EntityResolution, EnrichEntityType } from "./types";

/**
 * Resolve an entity — checks if a page already exists, determines type,
 * and scores notability.
 */
export async function resolveEntity(
  brainId: string,
  name: string,
  requestedType: EnrichEntityType | "auto" = "auto"
): Promise<EntityResolution> {
  const normalized = name.trim();

  // 1. Exact slug match (most common patterns)
  const exactHits = await queryMany<{
    slug: string; title: string; type: string;
    compiled_truth: string; updated_at: string;
  }>(
    `SELECT slug, title, type, compiled_truth, updated_at::text
     FROM pages
     WHERE brain_id = $1
       AND slug IN ($2, $3, $4)
     LIMIT 3`,
    [
      brainId,
      `people/${normalized.toLowerCase().replace(/\s+/g, "-")}`,
      `companies/${normalized.toLowerCase().replace(/\s+/g, "-")}`,
      normalized.toLowerCase().replace(/\s+/g, "-"),
    ]
  );

  if (exactHits.length > 0) {
    const hit = exactHits[0];
    const linkCount = await getLinkCount(brainId, hit.slug);
    return {
      exists: true,
      slug: hit.slug,
      title: hit.title,
      type: hit.type,
      content: hit.compiled_truth || null,
      updatedAt: hit.updated_at,
      linkCount,
      notable: true,
      detectedType: resolveType(hit.type, requestedType),
    };
  }

  // 2. Fuzzy search by title
  const fuzzyHits = await queryMany<{
    slug: string; title: string; type: string;
    compiled_truth: string; updated_at: string;
  }>(
    `SELECT slug, title, type, compiled_truth, updated_at::text
     FROM pages
     WHERE brain_id = $1
       AND (LOWER(title) LIKE $2 OR LOWER(slug) LIKE $2)
     ORDER BY updated_at DESC
     LIMIT 3`,
    [brainId, `%${normalized.toLowerCase()}%`]
  );

  if (fuzzyHits.length > 0) {
    const hit = fuzzyHits[0];
    const linkCount = await getLinkCount(brainId, hit.slug);
    return {
      exists: true,
      slug: hit.slug,
      title: hit.title,
      type: hit.type,
      content: hit.compiled_truth || null,
      updatedAt: hit.updated_at,
      linkCount,
      notable: true,
      detectedType: resolveType(hit.type, requestedType),
    };
  }

  // 3. Not found — determine notability from context clues
  // Any named entity that the user explicitly requests enrichment for
  // passes the notability gate.
  return {
    exists: false,
    slug: null,
    title: null,
    type: null,
    content: null,
    updatedAt: null,
    linkCount: 0,
    notable: true, // User requested it, so it's notable
    detectedType: requestedType === "auto" ? "person" : requestedType,
  };
}

async function getLinkCount(brainId: string, slug: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::int AS count
     FROM links
     WHERE brain_id = $1
       AND (
         from_page_id = (SELECT id FROM pages WHERE brain_id = $1 AND slug = $2)
         OR to_page_id = (SELECT id FROM pages WHERE brain_id = $1 AND slug = $2)
       )`,
    [brainId, slug]
  );
  return parseInt(row?.count || "0");
}

/**
 * Map a page type to a standardized entity type.
 */
function resolveType(
  dbType: string,
  requested: EnrichEntityType | "auto"
): EnrichEntityType {
  if (requested !== "auto") return requested;
  if (dbType === "person") return "person";
  if (dbType === "company" || dbType === "organization") return "company";
  // Default to person for unknown types
  return "person";
}

/**
 * Suggest a standardized slug for a new entity.
 */
export function suggestSlug(
  name: string,
  type: EnrichEntityType
): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const prefix = type === "company" ? "companies" : "people";
  return `${prefix}/${normalized}`;
}
