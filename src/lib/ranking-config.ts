/**
 * Ranking Configuration — tunable weights for the search pipeline.
 *
 * All weights that affect ranking are centralized here so the eval→rank
 * feedback loop can adjust them without touching pipeline code.
 *
 * Defaults are the production values as of v2.2.
 */

export interface RankingConfig {
  /** Reciprocal Rank Fusion K constant (higher = flatter, lower = rank-sensitive) */
  rrfK: number;

  /** Per-page-type boost multipliers */
  sourceBoosts: Record<string, number>;

  /** Multiplier for results whose best chunk is from compiled_truth */
  compiledTruthBoost: number;

  /** Backlink boost coefficient: score *= 1 + backlinkCoef * log(1 + backlink_count) */
  backlinkCoef: number;

  /** Tweet boost for tweet-intent queries */
  tweetBoostFull: number;

  /** Tweet boost baseline for non-tweet-intent queries */
  tweetBoostBaseline: number;

  /** Exact match pin score (forces to top) */
  exactPinScore: number;
}

/** Production defaults */
export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  rrfK: 60,

  sourceBoosts: {
    original: 1.5,
    writing: 1.4,
    concept: 1.3,
    person: 1.2,
    project: 1.35, // High-priority project pages (Brainbase, etc.)
    meeting: 1.1,
    decision: 1.1,
    tweet: 0.9,
    blog: 0.9,
  },

  compiledTruthBoost: 1.15,
  backlinkCoef: 0.05,
  tweetBoostFull: 2.5,
  tweetBoostBaseline: 2.0,
  exactPinScore: 100.0,
};

/** Active config — starts with defaults, mutated by eval tuner */
let activeConfig: RankingConfig = { ...DEFAULT_RANKING_CONFIG, sourceBoosts: { ...DEFAULT_RANKING_CONFIG.sourceBoosts } };

export function getRankingConfig(): RankingConfig {
  return activeConfig;
}

export function setRankingConfig(config: Partial<RankingConfig>): void {
  activeConfig = {
    ...activeConfig,
    ...config,
    sourceBoosts: config.sourceBoosts
      ? { ...activeConfig.sourceBoosts, ...config.sourceBoosts }
      : activeConfig.sourceBoosts,
  };
}

export function resetRankingConfig(): void {
  activeConfig = { ...DEFAULT_RANKING_CONFIG, sourceBoosts: { ...DEFAULT_RANKING_CONFIG.sourceBoosts } };
}
