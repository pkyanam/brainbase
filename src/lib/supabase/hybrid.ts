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
import { getRankingConfig } from "../ranking-config";

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
  source_type?: number;
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

/**
 * Apply compiled_truth boost (1.15x) to results whose best chunk is from compiled_truth.
 * Subtle boost — does NOT create an artificial score ceiling like 2.0x did.
 */
export function applyCompiledTruthBoost(
  fused: Map<string, { score: number; results: SearchResult[]; boost_factors?: BoostFactors }>
): void {
  const cfg = getRankingConfig();
  for (const [, entry] of fused) {
    const hasCompiledTruth = entry.results.some(
      (r) => (r as any).chunk_source === "compiled_truth" || (r as any).chunk_source === undefined
    );
    if (hasCompiledTruth) {
      entry.score *= cfg.compiledTruthBoost;
      if (!entry.boost_factors) entry.boost_factors = { total: 1.0 };
      entry.boost_factors.compiled_truth = cfg.compiledTruthBoost;
      entry.boost_factors.total = (entry.boost_factors.total || 1) * cfg.compiledTruthBoost;
    }
  }
}

// ─── Source-Aware Ranking ──────────────────────────────────────
/**
 * Source-aware ranking boost (matching GBrain v0.25 source-boost.ts).
 * Curated, high-signal page types get a multiplier over bulk imports.
 *
 * Boost factors:
 *   - originals     1.5×  (primary sources, authored content)
 *   - writing       1.4×  (long-form writing, essays)
 *   - concept       1.3×  (structured knowledge)
 *   - person        1.2×  (entity pages, identity anchors)
 *   - meeting       1.1×  (decision records)
 *   - tweet/blog    0.9×  (bulk/chronological, slightly discount)
 */
export function applySourceBoost(
  fused: Map<string, { score: number; results: SearchResult[]; boost_factors?: BoostFactors }>
): void {
  const cfg = getRankingConfig();
  for (const [, entry] of fused) {
    const bestResult = entry.results.reduce((a, b) => (a.score > b.score ? a : b), entry.results[0]);
    const pageType = bestResult?.type?.toLowerCase() || "";
    const multiplier = cfg.sourceBoosts[pageType] || 1.0;

    if (multiplier !== 1.0) {
      entry.score *= multiplier;
      if (!entry.boost_factors) entry.boost_factors = { total: 1.0 };
      entry.boost_factors.source_type = Math.round(multiplier * 1000) / 1000;
      entry.boost_factors.total = (entry.boost_factors.total || 1) * multiplier;
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
  const cfg = getRankingConfig();
  for (const [slug, entry] of fused) {
    const bl = backlinks.get(slug) || 0;
    if (bl > 0) {
      const multiplier = 1 + cfg.backlinkCoef * Math.log(1 + bl);
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

export type QueryIntent = "temporal" | "entity" | "event" | "tweet" | "general";

const TEMPORAL_PATTERNS = [
  /\b(when|what year|what month|what day|what date|how old|how long ago|recent|latest|newest|last|past|this week|this month|this year|today|yesterday|tomorrow)\b/i,
  // Removed bare year pattern — "happy new year 2014" is not a temporal query.
  // Years only trigger temporal with context words: "from 2014", "since 2020", "in 2015".
  /\b(from|since|in|during|throughout)\s+(20\d{2})\b/i,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  /\b(since|until|before|after|during|between)\b/i,
];

// Phase 2.0: Tweet intent patterns — detect tweet-specific queries
// BEFORE entity/event patterns to prevent misclassification.
// "tweets about Apple" → tweet, not entity. "first tweet" → tweet, not general.
const TWEET_PATTERNS = [
  /\b(tweet|tweets|tweeted|retweet|retweeted|quote tweet|quote tweeted)\b/i,
  /\b(post|posted|repost|x\.com|twitter)\b/i,
  /\b(tweets? about|tweets? from|tweets? mentioning|tweets? on|tweets? regarding)\b/i,
  /\b(my tweet|my tweets|my last tweet|my first tweet|first tweet|last tweet)\b/i,
  /\b(how many tweets|tweet count|number of tweets)\b/i,
  /\b(\d+(?:st|nd|rd|th)\s+tweet|tweet\s+\d+)\b/i,
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

  // Phase 2.1: Tweet intent (checked FIRST — "tweets from 2014" is tweet, not temporal.
  // "my last tweet" is tweet, not temporal. Must precede temporal to avoid date/year
  // keywords stealing tweet-intent queries.)
  for (const pattern of TWEET_PATTERNS) {
    if (pattern.test(q) || pattern.test(processed)) return "tweet";
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

    // B3 FIX v2: Require at least 2 capitalized content words to trigger entity.
    // Single-capital-word queries like "PS5 linux loader" (PS5 is capital, rest lowercase)
    // or "13 Pro Max apple" (Pro/Max are capital) are more likely product/topic descriptions
    // than proper names. Real names like "Matthew Kovalenko" or "Garry Tan" have 2+ capitals.
    //
    // Count capitalized content words (exclude particles and short words < 2 chars)
    const contentWords = words.filter(w => w.length >= 2 && !particles.has(w.toLowerCase()));
    const capitalizedWords = contentWords.filter(w => /^[A-Z]/.test(w));
    const capRatio = contentWords.length > 0 ? capitalizedWords.length / contentWords.length : 0;

    // Entity if: 2+ capitalized words AND >40% of content words are capitalized
    // This catches "Matthew Kovalenko" (2/2=100%) and "Tyler van Burk" (2/2 after particle filter)
    // but rejects "PS5 linux loader" (1/3=33%) and "13 Pro Max apple" (2/4=50%, borderline but
    // "13" isn't content, "apple" is lowercase — actually 2/3=67% which is borderline.
    // Let's use: 2+ capitalized AND >50% ratio)
    if (capitalizedWords.length >= 2 && capRatio > 0.5) return "entity";

    // Single capitalized word: name-like (capital + lowercase, 3+ chars) or acronym (all caps, 2+)
    if (capitalizedWords.length === 1) {
      const w = capitalizedWords[0];
      if (/^[A-Z][a-z]{2,}$/.test(w)) return "entity";  // "Matthew", "Garry"
      if (/^[A-Z]{2,}$/.test(w)) return "entity";        // "YC", "AWS", "AI"
    }
  }

  // Single capitalized word ≥3 chars that looks like a name
  if (words.length === 1 && /^[A-Z][a-z]{2,}$/.test(words[0]) && words[0].length >= 3) {
    return "entity";
  }

  // Single all-caps word (acronym like "YC", "AI", "CEO")
  if (words.length === 1 && /^[A-Z]{2,}$/.test(words[0])) {
    return "entity";
  }

  // Phase 2.2: Lowercase single-word entity detection.
  // "hermes", "pkyanam", "lara", "brainbase" — single lowercase words
  // that are likely entity/project/handle lookups. The old classifier only
  // caught capitalized proper nouns, missing ~30% of real entity queries.
  if (words.length === 1 && /^[a-z][a-z0-9_-]{1,}$/.test(words[0]) && words[0].length >= 2) {
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
    case "tweet":
      return "high";  // tweet: high detail — return multiple tweets per page, enable timeline-style dedup
    default:
      return "medium";
  }
}

// ─── Phase 2.1: Tweet-Aware Re-Ranker ─────────────────────────────
/**
 * When query intent is "tweet", apply a strong score multiplier to type=tweet results.
 * For ALL other intents, apply a baseline boost so tweet-body queries (e.g.,
 * "PS5 linux loader") that lack tweet keywords still surface tweet pages.
 *
 * Tweet intent: 2.5x multiplier
 * All other intents: 2.0x baseline (tweets have zero backlinks, need significant help)
 *
 * Applied AFTER backlink boost but BEFORE forceExactMatchTop.
 */
const TWEET_BOOST_FULL = 2.5;
const TWEET_BOOST_BASELINE = 2.0;

export function applyTweetBoost(
  results: Array<{ slug: string; score: number; type: string; boost_factors?: BoostFactors }>,
  intent?: string,
): void {
  const multiplier = intent === "tweet" ? TWEET_BOOST_FULL : TWEET_BOOST_BASELINE;
  for (const r of results) {
    // Skip only ultra-high pinned results (ordinal at 100.0, ordinal fallback at 95.0).
    // Date (2.0), entity_mention (1.5), and hybrid RRF (~0.3-0.8) all get boosted.
    if (r.type === "tweet" && r.score < 90) {
      r.score *= multiplier;
      if (!r.boost_factors) r.boost_factors = { total: 1.0 };
      (r.boost_factors as any).tweet_boost = multiplier;
      r.boost_factors.total = (r.boost_factors.total || 1) * multiplier;
    }
  }
}

// ─── Phase 2.0: Ordinal Parser ────────────────────────────────────
/**
 * Parse tweet ordinal queries like "first tweet", "last tweet", "2000th tweet".
 * Returns { ordinal: number, mode: "exact" | "first" | "last" } or null.
 */
export interface OrdinalMatch {
  ordinal: number;
  mode: "exact" | "first" | "last";
}

const ORDINAL_WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};

export function parseTweetOrdinal(query: string): OrdinalMatch | null {
  const q = query.toLowerCase().trim();

  // "first tweet" / "my first tweet"
  if (/\b(first|1st)\s+tweet\b/i.test(q)) return { ordinal: 1, mode: "first" };

  // "last tweet" / "my last tweet" / "most recent tweet"
  if (/\b(last|latest|most recent|newest)\s+tweet\b/i.test(q)) return { ordinal: -1, mode: "last" };

  // Word ordinals: "second tweet", "fifth tweet", etc.
  for (const [word, num] of Object.entries(ORDINAL_WORDS)) {
    if (new RegExp(`\\b${word}\\s+tweet\\b`, "i").test(q)) {
      return { ordinal: num, mode: "exact" };
    }
  }

  // Numeric ordinals: "2000th tweet", "tweet 1000", "1000th tweet", "tweet number 1"
  const numMatch = q.match(/(\d+)(?:st|nd|rd|th)?\s+tweet/i)
    || q.match(/tweet\s+number\s+(\d+)/i)
    || q.match(/tweet\s+(\d+)/i);
  if (numMatch) {
    return { ordinal: parseInt(numMatch[1], 10), mode: "exact" };
  }

  return null;
}

// ─── Phase 2.0: Date Parser for Tweet Queries ─────────────────────
/**
 * Parse date ranges from tweet queries: "tweets from 2014", "tweets from April 2020",
 * "tweets from April 29 2026". Returns { year?, month?, day? } or null.
 */
export interface DateRangeMatch {
  year?: number;
  month?: number;  // 1-12
  day?: number;    // 1-31
}

const MONTH_NAMES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export function parseTweetDateRange(query: string): DateRangeMatch | null {
  const q = query.toLowerCase().trim();
  const result: DateRangeMatch = {};

  // Year: "from 2014", "from 2020", "in 2014", "2014 tweets", "from April 2026"
  const yearMatch = q.match(/\b(20\d{2})\b/);
  if (yearMatch) result.year = parseInt(yearMatch[1], 10);

  // Month name: "from April", "April 2020", "from April 29"
  for (const [name, num] of Object.entries(MONTH_NAMES)) {
    if (new RegExp(`\\b${name}\\b`, "i").test(q)) {
      result.month = num;
      break;
    }
  }

  // Numeric month: "from 04/2020", "2020-04-29"
  const numMonthMatch = q.match(/\b(\d{1,2})\/(\d{4})\b/) || q.match(/(\d{4})-(\d{2})/);
  if (numMonthMatch) {
    result.month = parseInt(numMonthMatch[1], 10);
    if (!result.year) result.year = parseInt(numMonthMatch[2], 10);
  }

  // Day: "April 29", "29th", "April 29 2026"
  const dayMatch = q.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10);
    if (day >= 1 && day <= 31) result.day = day;
  }

  // Only return if we found at least a year or month
  if (result.year || result.month) return result;
  return null;
}
