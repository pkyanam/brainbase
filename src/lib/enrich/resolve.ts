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
 * When type is "auto" and entity not found, use heuristics.
 */
function resolveType(
  dbType: string,
  requested: EnrichEntityType | "auto"
): EnrichEntityType {
  if (requested !== "auto") return requested;
  if (dbType === "person") return "person";
  if (dbType === "company" || dbType === "organization") return "company";
  // Fall through to heuristics when dbType is something else (concept, note, etc.)
  return "person";
}

/**
 * Auto-detect entity type when the user didn't specify one.
 * Uses fast heuristics — no LLM call needed.
 */
export function detectEntityType(name: string): EnrichEntityType {
  const n = name.trim();

  // Known company suffixes
  const companySuffixes = [
    "Inc", "Inc.", "Corp", "Corp.", "Corporation", "LLC", "Ltd", "Ltd.",
    "GmbH", "AG", "SA", "SAS", "SRL", "PLC", "LLP", "LP",
    "Incorporated", "Limited",
  ];
  for (const suffix of companySuffixes) {
    if (n.endsWith(` ${suffix}`) || n === suffix) return "company";
  }

  // Descriptor words that suggest a company
  const companyWords = [
    "Labs", "Technologies", "Software", "Solutions", "Systems",
    "Ventures", "Capital", "Partners", "Group", "Holdings",
    "Networks", "Analytics", "Dynamics", "Robotics", "Therapeutics",
    "Biosciences", "Energy", "Financial", "Insurance", "Media",
    "Studios", "Games", "Pharmaceuticals", "Airlines",
  ];
  for (const word of companyWords) {
    if (n.toLowerCase().includes(` ${word.toLowerCase()}`)) return "company";
  }

  // Common single-word company names (startup/tech-heavy subset)
  const knownCompanies = new Set([
    "stripe", "google", "apple", "microsoft", "amazon", "meta", "netflix",
    "openai", "anthropic", "deepmind", "notion", "figma", "linear",
    "vercel", "supabase", "clerk", "convex", "replit", "cursor",
    "midjourney", "runway", "huggingface", "stability", "cohere",
    "adept", "character", "perplexity", "mistral", "inflection",
    "databricks", "snowflake", "palantir", "airbnb", "uber", "lyft",
    "doordash", "instacart", "robinhood", "coinbase", "binance",
    "stripe", "square", "paypal", "spotify", "slack", "zoom",
    "atlassian", "salesforce", "oracle", "sap", "ibm", "intel",
    "nvidia", "amd", "tesla", "rivian", "lucid", "sonos", "peloton",
    "grammarly", "calendly", "lattice", "rippling", "deel", "remote",
    "canva", "miro", "webflow", "spline", "unity", "epic",
    "bloomberg", "reuters", "axios", "theinformation", "techcrunch",
    "sequoia", "benchmark", "a16z", "accel", "foundersfund",
    "greylock", "kleiner", "lightspeed", "indexventures", "bessemer",
    "ycombinator",
  ]);
  if (knownCompanies.has(n.toLowerCase())) return "company";

  // Person signals: single name, honorifics, known person names
  const personPrefixes = ["Dr.", "Dr ", "Mr.", "Mr ", "Mrs.", "Mrs ",
    "Ms.", "Ms ", "Prof.", "Prof ", "Sen.", "Rep.", "Gov."];
  for (const prefix of personPrefixes) {
    if (n.startsWith(prefix)) return "person";
  }

  // Two+ words with no company indicators → likely person
  const wordCount = n.split(/\s+/).length;
  if (wordCount >= 2) return "person";

  // Single word, not in known companies → ambiguous, default person
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
