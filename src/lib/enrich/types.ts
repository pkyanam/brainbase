/**
 * Enrichment Pipeline Types
 *
 * GBrain parity: tiered enrichment protocol adapted for Brainbase.
 */

export type EnrichTier = 1 | 2 | 3;

export type EnrichEntityType = "person" | "company" | "auto";

export interface EnrichRequest {
  /** Name of the entity to enrich */
  name: string;

  /** Entity type, or "auto" to auto-detect from brain or LLM */
  type?: EnrichEntityType;

  /** Enrichment tier: 1=full deep research, 2=moderate, 3=lightweight */
  tier?: EnrichTier;

  /** Optional context about the entity (why enriching, relationship, etc.) */
  context?: string;

  /** If true, force re-enrich even if page was recently updated */
  force?: boolean;

  /** Whether to process asynchronously via minion job queue */
  async?: boolean;
}

export interface EnrichResult {
  /** The enriched page slug */
  slug: string;

  /** Page title */
  title: string;

  /** Page type */
  type: string;

  /** Whether this was a new page or an update */
  action: "created" | "updated" | "skipped";

  /** The full compiled truth (markdown content) */
  compiledTruth: string;

  /** External sources consulted */
  sources: string[];

  /** New signals detected (what changed) */
  newSignals: string[];

  /** When the enrichment was completed */
  enrichedAt: string;

  /** Links created during cross-referencing */
  linksCreated: number;

  /** Raw data entries stored */
  rawDataStored: number;
}

export interface EnrichError {
  error: string;
  code?: string;
  detail?: string;
}

export interface EntityResolution {
  exists: boolean;
  slug: string | null;
  title: string | null;
  type: string | null;
  content: string | null;
  updatedAt: string | null;
  linkCount: number;
  /** Whether the entity is notable enough to enrich */
  notable: boolean;
  /** Detected type if "auto" was requested */
  detectedType: EnrichEntityType | null;
}

export interface EnrichSourceData {
  /** Raw text response from the source */
  content: string;

  /** Source identifier (e.g., "openai", "brave") */
  source: string;

  /** When the data was fetched */
  fetchedAt: string;

  /** Metadata about the fetch (model, tokens, etc.) */
  meta?: Record<string, unknown>;
}

/**
 * Tier configuration — controls depth and sources.
 */
export interface TierConfig {
  /** LLM model to use */
  model: string;

  /** Max completion tokens */
  maxTokens: number;

  /** External sources to consult */
  externalSources: string[];

  /** How many sections to generate */
  sectionCount: number;

  /** Whether to do deep cross-referencing */
  deepCrossRef: boolean;
}

export const TIER_CONFIGS: Record<EnrichTier, TierConfig> = {
  1: {
    model: "gpt-5.4-nano",
    maxTokens: 4096,
    externalSources: ["brave", "openai"],
    sectionCount: 12,
    deepCrossRef: true,
  },
  2: {
    model: "gpt-5.4-nano",
    maxTokens: 2048,
    externalSources: ["brave", "openai"],
    sectionCount: 6,
    deepCrossRef: false,
  },
  3: {
    model: "gpt-5.4-nano",
    maxTokens: 1024,
    externalSources: ["openai"],
    sectionCount: 3,
    deepCrossRef: false,
  },
};
