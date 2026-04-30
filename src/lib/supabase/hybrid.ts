/**
 * Hybrid Search Engine — Phase 1.1 Search Quality Fixes for Brainbase.
 *
 * Pipeline: Keyword + Vector → Vector Slug Dedup → RRF Fusion → Normalize →
 *   Exact Match Boost → Compiled Truth Boost → Backlink Boost →
 *   Single-Page Cap → 4-Layer Dedup → Sort
 *
 * Fixes from Arlan's stress test (2026-04-30):
 *   B1: Dedup vector results by slug BEFORE RRF (fixes duplicate slugs)
 *   B2: Exact-title/slug match boost (3-5x, fixes buried entity pages)
 *   B3: Capitalized proper noun → entity intent
 *   B4: chunk_source + boost_factors exposed in response
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
 * B1 FIX: Dedup a ranked list by slug BEFORE RRF.
 * Vector search returns one row per CHUNK — multiple rows per page.
 * Before RRF, collapse to one entry per slug keeping the max score.
 * This prevents the same page from flooding RRF with duplicate entries.
 */
export function dedupBySlug<T extends { slug: string; score: number }>(list: T[]): T[] {
  const seen = new Map<string, T>();
  for (const r of list) {
    const existing = seen.get(r.slug);
    if (!existing || r.score > existing.score) {
      seen.set(r.slug, r);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.score - a.score);
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
  }
  return normed;
}

// ─── Boost Factor Tracking ───────────────────────────────────────

export interface BoostFactors {
  exact_match?: number;
  compiled_truth?: number;
  backlinks?: number;
  /** Total multiplier applied */
  total: number;
}

/** Attach boost_factors to a search result entry */
export type BoostedResult = SearchResult & { boost_factors?: BoostFactors };

// ─── B2 FIX v2: Pin Exact Matches at Rank 0 ─────────────────────

/**
 * B2 FIX v3: Strip question prefixes ("who is", "what is", etc.)
 * before comparing for exact match. So "who is Tyler van Burk"
 * matches the page "Tyler van Burk".
 */
const QUESTION_PREFIXES = [
  /^who\s+is\s+/i,
  /^who's\s+/i,
  /^what\s+is\s+/i,
  /^what's\s+/i,
  /^what\s+are\s+/i,
  /^tell\s+me\s+about\s+/i,
  /^info\s+on\s+/i,
  /^details\s+on\s+/i,
  /^profile\s+of\s+/i,
];

export function stripQuestionPrefix(query: string): string {
  for (const pattern of QUESTION_PREFIXES) {
    const stripped = query.replace(pattern, "").trim();
    if (stripped !== query) return stripped;
  }
  return query;
}

/** Check if a slug or title exactly matches the query (after prefix stripping). */
function isExactMatch(slug: string, title: string, query: string): boolean {
  const qLower = query.toLowerCase().trim();
  const titleLower = (title || "").toLowerCase();
  const slugLower = (slug || "").toLowerCase();
  const slugBase = slugLower.split("/").pop() || slugLower;
  const slugNormalized = slugBase.replace(/[-_]/g, " ");

  // Try exact match first
  if (titleLower === qLower || slugNormalized === qLower || slugLower === qLower) {
    return true;
  }

  // Try with question prefix stripped
  const stripped = stripQuestionPrefix(qLower);
  if (stripped !== qLower) {
    if (titleLower === stripped || slugNormalized === stripped || slugLower === stripped) {
      return true;
    }
  }

  return false;
}

/**
 * B2 FIX v2: Before RRF, reorder each result list so pages whose
 * title or slug exactly matches the query appear at position 0.
 * This gives them maximum RRF contribution (1/K) from every list,
 * guaranteeing they outrank any non-exact-match page.
 *
 * Removed: the old score-multiplier approach (5x/4x/2.5x) which
 * couldn't overcome the RRF baseline advantage of dense multi-list pages.
 */
export function pinExactMatches(
  list: SearchResult[],
  query: string
): SearchResult[] {
  if (!query.trim()) return list;

  const exact: SearchResult[] = [];
  const rest: SearchResult[] = [];

  for (const r of list) {
    if (isExactMatch(r.slug, r.title, query)) {
      exact.push(r);
    } else {
      rest.push(r);
    }
  }

  return [...exact, ...rest];
}

/**
 * B2 FIX v2: After RRF and all boosts, force exact-match pages
 * to the absolute top by giving them a score above the normal range.
 *
 * Score 100.0 is well above any possible RRF-normalized+boosted score
 * (which maxes out around 1.0-5.0). This guarantees exact matches
 * appear before any other page regardless of chunk density.
 */
const EXACT_PIN_SCORE = 100.0;

export function forceExactMatchTop(
  fused: Map<string, { score: number; results: SearchResult[]; boost_factors?: BoostFactors }>,
  query: string
): void {
  for (const [slug, entry] of fused) {
    const title = entry.results[0]?.title || "";
    if (isExactMatch(slug, title, query)) {
      entry.score = EXACT_PIN_SCORE;
      if (!entry.boost_factors) entry.boost_factors = { total: 1.0 };
      entry.boost_factors.exact_match = EXACT_PIN_SCORE;
      entry.boost_factors.total = EXACT_PIN_SCORE;
    }
  }
}

/**
 * Array-based version of forceExactMatchTop — works on flat result arrays
 * after flattenResults + dedupBySlug. Sets exact-match scores to 100.0.
 */
export function forceExactMatchTopFinal(
  results: Array<{ slug: string; score: number; title: string; boost_factors?: BoostFactors }>,
  query: string
): void {
  for (const r of results) {
    if (isExactMatch(r.slug, r.title, query)) {
      r.score = EXACT_PIN_SCORE;
      if (!r.boost_factors) r.boost_factors = { total: 1.0 };
      r.boost_factors.exact_match = EXACT_PIN_SCORE;
      r.boost_factors.total = EXACT_PIN_SCORE;
    }
  }
}

// ─── Compiled Truth Boost ─────────────────────────────────────────
const COMPILED_TRUTH_BOOST = 1.15;

/**
 * Apply compiled_truth boost (1.15x) to results whose best chunk is from compiled_truth.
 * Subtle boost — does NOT create an artificial score ceiling like 2.0x did.
 */
export function applyCompiledTruthBoost(
  fused: Map<string, { score: number; results: SearchResult[]; boost_factors?: BoostFactors }>
): void {
  for (const [, entry] of fused) {
    const hasCompiledTruth = entry.results.some(
      (r) => (r as any).chunk_source === "compiled_truth" || (r as any).chunk_source === undefined
    );
    if (hasCompiledTruth) {
      entry.score *= COMPILED_TRUTH_BOOST;
      if (!entry.boost_factors) entry.boost_factors = { total: 1.0 };
      entry.boost_factors.compiled_truth = COMPILED_TRUTH_BOOST;
      entry.boost_factors.total = (entry.boost_factors.total || 1) * COMPILED_TRUTH_BOOST;
    }
  }
}

// ─── Backlink Boost ───────────────────────────────────────────────
/**
 * Apply backlink boost: score *= (1 + 0.05 * log(1 + backlink_count))
 */
export function applyBacklinkBoost(
  fused: Map<string, { score: number; results: SearchResult[]; boost_factors?: BoostFactors }>,
  backlinks: Map<string, number>
): void {
  for (const [slug, entry] of fused) {
    const bl = backlinks.get(slug) || 0;
    if (bl > 0) {
      const multiplier = 1 + 0.05 * Math.log(1 + bl);
      entry.score *= multiplier;
      if (!entry.boost_factors) entry.boost_factors = { total: 1.0 };
      entry.boost_factors.backlinks = Math.round(multiplier * 1000) / 1000;
      entry.boost_factors.total = (entry.boost_factors.total || 1) * multiplier;
    }
  }
}

// ─── B1+B2 FIX: Single-Page Contribution Cap ─────────────────────

/**
 * B1 FIX: Cap single-page multi-chunk contribution.
 * For each page in the fused results, keep only the best 1-2 results
 * (depending on detail level) rather than letting one dense page flood
 * the output with many chunks.
 */
export function capPageContributions<T extends { slug: string }>(
  results: T[],
  maxPerPage: number = 1
): T[] {
  const counts = new Map<string, number>();
  const output: T[] = [];
  for (const r of results) {
    const cnt = counts.get(r.slug) || 0;
    if (cnt >= maxPerPage) continue;
    counts.set(r.slug, cnt + 1);
    output.push(r);
  }
  return output;
}

// ─── 4-Layer Dedup ────────────────────────────────────────────────

export interface DedupOptions {
  maxPerPage?: number;
  maxTypeFraction?: number;
  jaccardThreshold?: number;
  maxPerSource?: number;
}

const DEFAULT_DEDUP: Required<DedupOptions> = {
  maxPerPage: 2,
  maxTypeFraction: 0.6,
  jaccardThreshold: 0.85,
  maxPerSource: 3,
};

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

export function dedupResults<T extends { slug: string; score: number; excerpt: string; type: string; source: string; chunk_source?: string }>(
  results: T[],
  opts: DedupOptions = {}
): T[] {
  const o = { ...DEFAULT_DEDUP, ...opts };

  // Layer 1: Top chunks per source per page
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

  // Layer 2: Text similarity dedup
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

  // Layer 3: Type diversity
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

  // Layer 4: Page cap
  const layer4 = capPageContributions(layer3, o.maxPerPage);

  // Layer 5: Compiled truth guarantee
  const pageHasCT = new Map<string, boolean>();
  for (const r of layer4) {
    if (r.chunk_source === "compiled_truth") {
      pageHasCT.set(r.slug, true);
    }
  }

  const pageCounts = new Map<string, number>();
  for (const r of layer4) {
    pageCounts.set(r.slug, (pageCounts.get(r.slug) || 0) + 1);
  }

  for (let i = 0; i < layer1.length; i++) {
    const r = layer1[i];
    if (
      r.chunk_source === "compiled_truth" &&
      !pageHasCT.get(r.slug) &&
      pageCounts.has(r.slug)
    ) {
      layer4.push(r);
      pageHasCT.set(r.slug, true);
    }
  }

  return layer4;
}

// ─── B3 FIX: Query Intent Classifier ──────────────────────────────

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

// Phase 1.6: Relational queries — "who helps me", "who did I grow up with", etc.
// These are entity queries about people connected to the user through relationships.
// They should NOT fall through to general intent.
const RELATIONAL_PATTERNS = [
  /\b(who helps me|who works with me|who do I work with|who supports me|who assists me|my agents|my assistants)\b/i,
  /\b(who did I grow up with|who grew up with|childhood friends|grew up together)\b/i,
  /\b(who do I know|who do we know|people I know|my network|my connections)\b/i,
  /\b(who.*(?:helps|works|assists|supports|collaborates)\s+(?:me|with me))\b/i,
];

// Phase 1.6: Bug/issue patterns — trigger timeline + event search for diagnostic queries
// "what's wrong with X", "broken", "bug", "not working" → search timeline entries
const ISSUE_PATTERNS = [
  /\b(what's wrong|what is wrong|whats wrong|something wrong|not working|is broken|is bugged)\b/i,
  /\b(broken|bug|issue|fix|fixed|problem|error|crash|glitch|regression)\b/i,
  /\b(doesn't work|does not work|won't load|can't load|cannot load|not showing)\b/i,
];

const EVENT_PATTERNS = [
  /\b(meeting|call|conference|talk|presentation|workshop|summit|hackathon|launch|demo day|batch)\b/i,
  /\b(happened|occurred|took place|went down|went|did.*go)\b/i,
];

/**
 * B3 FIX: Classify query intent using pattern matching + proper noun heuristic.
 *
 * New: capitalized multi-token inputs (e.g. "Matthew Kovalenko", "Tyler van Burk")
 * auto-classify as entity queries. Handles mid-name lowercase particles
 * (van, von, de, etc.) so "Tyler van Burk" → entity, not general.
 */
export function classifyIntent(query: string): QueryIntent {
  const q = query.trim();

  // Phase 1.6: Strip possessive prefix before classification
  // "my side projects" → "side projects", "my brain" → "brain"
  let processed = q;
  const possessiveStripped = q.replace(/^my\s+/i, '').replace(/^mine\s+/i, '');
  if (possessiveStripped !== q) {
    processed = possessiveStripped;
  }

  // Temporal
  for (const pattern of TEMPORAL_PATTERNS) {
    if (pattern.test(q) || pattern.test(processed)) return "temporal";
  }

  // Entity patterns
  for (const pattern of ENTITY_PATTERNS) {
    if (pattern.test(q) || pattern.test(processed)) return "entity";
  }

  // Phase 1.6: Relational patterns (checked BEFORE event, after entity)
  for (const pattern of RELATIONAL_PATTERNS) {
    if (pattern.test(q) || pattern.test(processed)) return "entity";
  }

  // Event patterns (check BEFORE proper-noun — "Launch event" is event, not entity)
  for (const pattern of EVENT_PATTERNS) {
    if (pattern.test(q) || pattern.test(processed)) return "event";
  }

  // Phase 1.6: Bug/issue queries → event intent (triggers timeline retrieval)
  // "what's wrong with", "broken", "bug", "issue", "fix" should search timeline entries
  for (const pattern of ISSUE_PATTERNS) {
    if (pattern.test(q) || pattern.test(processed)) return "event";
  }

  // B3 FIX: Capitalized proper noun detection
  // - Check event patterns FIRST (before proper-noun, since "Launch event"
  //   has a capitalized word but is clearly an event query)
  // - If ANY word starts with uppercase in a multi-word query → entity
  // - Handles: "Apple bros", "YC pitch", "Matthew Kovalenko"
  const words = processed.split(/\s+/).filter(w => w.length >= 1);
  const particles = new Set([
    "van", "von", "de", "di", "da", "del", "della", "dela", "dos", "du",
    "le", "la", "ten", "ter", "bin", "ibn", "al", "el", "of", "the",
  ]);

  // Common lowercase words that suggest entity search (relationship terms)
  const personWords = new Set([
    "mom", "mother", "dad", "father", "sister", "brother", "sibling",
    "cousin", "aunt", "uncle", "wife", "husband", "girlfriend", "boyfriend",
    "partner", "friend", "boss", "coworker", "colleague", "neighbor",
    "phone", "number", "email", "address", "contact",
  ]);

  if (words.length >= 2) {
    // Check for person-indicating words first (handles "mom phone number")
    const hasPersonWord = words.some(w => personWords.has(w.toLowerCase()));
    if (hasPersonWord) return "entity";

    // Any capitalized word that's not a particle → entity
    const hasProperNoun = words.some((w, i) => {
      if (i > 0 && particles.has(w.toLowerCase())) return false;
      // Must start with uppercase and be at least 2 chars (catches "YC")
      return /^[A-Z]/.test(w) && w.length >= 2;
    });
    if (hasProperNoun) return "entity";
  }

  // Single capitalized word ≥3 chars that looks like a name
  if (words.length === 1 && /^[A-Z][a-z]{2,}$/.test(words[0]) && words[0].length >= 3) {
    return "entity";
  }

  // Single all-caps word (acronym like "YC", "AI", "CEO")
  if (words.length === 1 && /^[A-Z]{2,}$/.test(words[0])) {
    return "entity";
  }

  return "general";
}

/**
 * Get the recommended detail level for a given intent.
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
