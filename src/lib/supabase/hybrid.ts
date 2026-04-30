/**
 * Hybrid Search Engine — Phase 1 Search Quality for Brainbase.
 *
 * Pipeline: Keyword + Vector → RRF Fusion → Normalize →
 *   Compiled Truth Boost → Backlink Boost → 4-Layer Dedup → Sort
 *
 * Architecture mirrors GBrain's hybrid.ts, adapted for multi-tenant Brainbase.
 */

import { SearchResult } from "./search";

// ─── RRF (Reciprocal Rank Fusion) ────────────────────────────────
const RRF_K = 60;

/**
 * Reciprocal Rank Fusion across multiple ranked lists.
 * Formula: RRF(slug) = Σ 1/(K + rank) across all lists where slug appears.
 */
export function rrfFusion(
  lists: SearchResult[][],
  k: number = RRF_K
): Map<string, { score: number; results: SearchResult[] }> {
  const fused = new Map<string, { score: number; results: SearchResult[] }>();

  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank++) {
      const r = list[rank];
      if (!r.slug) continue;
      const entry = fused.get(r.slug) || { score: 0, results: [] };
      entry.score += 1 / (k + rank);
      entry.results.push(r);
      fused.set(r.slug, entry);
    }
  }

  return fused;
}

/**
 * Normalize RRF scores to 0-1 range.
 */
export function normalizeScores(
  fused: Map<string, { score: number; results: SearchResult[] }>
): Map<string, { score: number; results: SearchResult[] }> {
  let maxScore = 0;
  for (const entry of fused.values()) {
    if (entry.score > maxScore) maxScore = entry.score;
  }
  if (maxScore === 0) return fused;

  const normed = new Map(fused);
  for (const [slug, entry] of normed) {
    entry.score = entry.score / maxScore;
    normed.set(slug, entry);
  }
  return normed;
}

// ─── Compiled Truth Boost ─────────────────────────────────────────
const COMPILED_TRUTH_BOOST = 2.0;

/**
 * Apply compiled_truth boost (2.0x) to results whose best chunk is from compiled_truth.
 * Page-level results (undefined chunk_source) are implicitly compiled truth
 * since they come from the page's compiled_truth field via FTS.
 */
export function applyCompiledTruthBoost(
  fused: Map<string, { score: number; results: SearchResult[] }>
): void {
  for (const [slug, entry] of fused) {
    const hasCompiledTruth = entry.results.some(
      (r) => (r as any).chunk_source === "compiled_truth" || (r as any).chunk_source === undefined
    );
    if (hasCompiledTruth) {
      entry.score *= COMPILED_TRUTH_BOOST;
    }
  }
}

// ─── Backlink Boost ───────────────────────────────────────────────
/**
 * Apply backlink boost: score *= (1 + 0.05 * log(1 + backlink_count))
 * backlinks is a Map of slug → backlink_count.
 */
export function applyBacklinkBoost(
  fused: Map<string, { score: number; results: SearchResult[] }>,
  backlinks: Map<string, number>
): void {
  for (const [slug, entry] of fused) {
    const bl = backlinks.get(slug) || 0;
    if (bl > 0) {
      entry.score *= 1 + 0.05 * Math.log(1 + bl);
    }
  }
}

// ─── 4-Layer Dedup ────────────────────────────────────────────────

export interface DedupOptions {
  /** Max chunks per page (default 2) */
  maxPerPage?: number;
  /** Max fraction of results that can be one page type (default 0.6) */
  maxTypeFraction?: number;
  /** Jaccard similarity threshold for text dedup (default 0.85) */
  jaccardThreshold?: number;
  /** Max chunks per page by source (default 3) */
  maxPerSource?: number;
}

const DEFAULT_DEDUP: Required<DedupOptions> = {
  maxPerPage: 2,
  maxTypeFraction: 0.6,
  jaccardThreshold: 0.85,
  maxPerSource: 3,
};

/**
 * Jaccard similarity between two strings (word-level).
 */
function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  return intersection / (wordsA.size + wordsB.size - intersection);
}

/**
 * 4-layer dedup pipeline:
 *  1. By Source — top N chunks per source per page
 *  2. By Text Similarity — remove near-duplicates (Jaccard > threshold)
 *  3. By Type Diversity — no page type exceeds maxTypeFraction
 *  4. By Page — max chunks per page
 *  5. Compiled Truth Guarantee — ensure ≥1 compiled_truth chunk per page
 */
export function dedupResults<T extends { slug: string; score: number; excerpt: string; type: string; source: string; chunk_source?: string }>(
  results: T[],
  opts: DedupOptions = {}
): T[] {
  const o = { ...DEFAULT_DEDUP, ...opts };

  // ── Layer 1: Top chunks per source per page ─────────────────
  const byPageSource = new Map<string, Map<string, typeof results>>();
  for (const r of results) {
    const pageMap = byPageSource.get(r.slug) || new Map();
    const sourceList = pageMap.get(r.source) || [];
    sourceList.push(r);
    pageMap.set(r.source, sourceList);
    byPageSource.set(r.slug, pageMap);
  }

  const layer1: typeof results = [];
  for (const [, pageMap] of byPageSource) {
    for (const [, sourceList] of pageMap) {
      sourceList.sort((a, b) => b.score - a.score);
      layer1.push(...sourceList.slice(0, o.maxPerSource));
    }
  }

  // ── Layer 2: Text similarity dedup ─────────────────────────
  layer1.sort((a, b) => b.score - a.score);
  const layer2: typeof results = [];
  for (const r of layer1) {
    let isDup = false;
    for (const kept of layer2) {
      if (jaccardSimilarity(r.excerpt, kept.excerpt) > o.jaccardThreshold) {
        isDup = true;
        break;
      }
    }
    if (!isDup) layer2.push(r);
  }

  // ── Layer 3: Type diversity ────────────────────────────────
  const typeCounts = new Map<string, number>();
  for (const r of layer2) {
    typeCounts.set(r.type, (typeCounts.get(r.type) || 0) + 1);
  }
  const maxPerType = Math.max(1, Math.ceil(layer2.length * o.maxTypeFraction));

  const layer3: typeof results = [];
  const currentTypeCounts = new Map<string, number>();
  for (const r of layer2) {
    const ct = currentTypeCounts.get(r.type) || 0;
    if (ct >= maxPerType) continue;
    currentTypeCounts.set(r.type, ct + 1);
    layer3.push(r);
  }

  // ── Layer 4: Page cap ──────────────────────────────────────
  const pageCounts = new Map<string, number>();
  const layer4: typeof results = [];
  for (const r of layer3) {
    const pc = pageCounts.get(r.slug) || 0;
    if (pc >= o.maxPerPage) continue;
    pageCounts.set(r.slug, pc + 1);
    layer4.push(r);
  }

  // ── Layer 5: Compiled truth guarantee ──────────────────────
  // Ensure at least one compiled_truth chunk per page survives
  const pageHasCT = new Map<string, boolean>();
  for (const r of layer4) {
    if (r.chunk_source === "compiled_truth") {
      pageHasCT.set(r.slug, true);
    }
  }

  // If a page appears in results but has no compiled_truth chunk,
  // try to rescue one from earlier layers
  for (let i = 0; i < layer1.length; i++) {
    const r = layer1[i];
    if (
      r.chunk_source === "compiled_truth" &&
      !pageHasCT.get(r.slug) &&
      pageCounts.has(r.slug) // only for pages already present
    ) {
      // Insert at end to preserve it
      layer4.push(r);
      pageHasCT.set(r.slug, true);
    }
  }

  return layer4;
}

// ─── Query Intent Classifier ──────────────────────────────────────

export type QueryIntent = "temporal" | "entity" | "event" | "general";

const TEMPORAL_PATTERNS = [
  /\b(when|what year|what month|what day|what date|how old|how long ago|recent|latest|newest|last|past|this week|this month|this year|today|yesterday|tomorrow)\b/i,
  /\b(202[0-9]|20[12][0-9])\b/,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  /\b(since|until|before|after|during|between)\b/i,
];

const ENTITY_PATTERNS = [
  /\b(who is|who's|tell me about|what is|what's|what do you know about|info on|details on|profile of)\b/i,
  /^(who|what) /i,
  /\b(person|people|company|companies|org|organization|founder|ceo|cto|investor)\b/i,
];

const EVENT_PATTERNS = [
  /\b(meeting|call|conference|talk|presentation|workshop|summit|hackathon|launch|demo day|batch)\b/i,
  /\b(happened|occurred|took place|went down|went|did.*go)\b/i,
];

/**
 * Classify query intent using zero-latency heuristic pattern matching.
 * Returns the intent type — no LLM call required.
 */
export function classifyIntent(query: string): QueryIntent {
  const q = query.trim();

  // Check temporal first (most common)
  for (const pattern of TEMPORAL_PATTERNS) {
    if (pattern.test(q)) return "temporal";
  }

  // Check entity
  for (const pattern of ENTITY_PATTERNS) {
    if (pattern.test(q)) return "entity";
  }

  // Check event
  for (const pattern of EVENT_PATTERNS) {
    if (pattern.test(q)) return "event";
  }

  return "general";
}

/**
 * Get the recommended detail level for a given intent.
 * - temporal/event → high (return everything, don't over-summarize)
 * - entity → low (compiled truth only, synthetic answer)
 * - general → medium (balanced)
 */
export function detailForIntent(intent: QueryIntent): "low" | "medium" | "high" {
  switch (intent) {
    case "temporal":
    case "event":
      return "high";
    case "entity":
      return "low";
    default:
      return "medium";
  }
}
