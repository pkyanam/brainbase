/**
 * Multi-query expansion — LLM-powered query reformulation.
 * GBrain v0.25 parity: uses gpt-5.4-nano to generate
 * 2-3 alternative query formulations, then each is searched independently
 * and results merged via RRF.
 *
 * Prompt-injection defense: queries are sanitized before being sent to the LLM.
 * Latency optimization: in-memory LRU cache with 10-min TTL.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const EXPANSION_MODEL = "gpt-5.4-nano";
const MAX_EXPANDED = 3; // reduced from 4 → less latency, minimal recall loss

// ── LRU Cache ────────────────────────────────────────────────────────────
interface CacheEntry {
  queries: string[];
  ts: number;
}
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 200;

function getCached(query: string): string[] | null {
  const entry = CACHE.get(query);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    CACHE.delete(query);
    return null;
  }
  return entry.queries;
}

function setCached(query: string, queries: string[]): void {
  if (CACHE.size >= MAX_CACHE_SIZE) {
    const oldest = [...CACHE.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) CACHE.delete(oldest[0]);
  }
  CACHE.set(query, { queries, ts: Date.now() });
}

// ── Sanitization ────────────────────────────────────────────────────────────

export function sanitizeQueryForPrompt(query: string): string {
  return query
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // control chars
    .replace(/["`'\\]/g, "")                             // quotes + backslash
    .replace(/--/g, "-")                                 // SQL comment guard
    .replace(/\/\*/g, "")                                // SQL block comment
    .trim()
    .slice(0, 500);                                      // hard cap
}

// ── Expansion ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate 2-3 alternative query formulations using an LLM.
 * Returns the original query plus alternatives, or just the original on error.
 *
 * Optimizations:
 *   - In-memory LRU cache (10-min TTL)
 *   - 8s fetch timeout
 *   - Max 3 expanded queries (reduced from 4)
 */
export async function expandQueries(query: string): Promise<string[]> {
  if (!OPENAI_API_KEY || !query.trim()) return [query];

  // Check cache first
  const cached = getCached(query);
  if (cached) return cached;

  const safe = sanitizeQueryForPrompt(query);
  if (!safe) return [query];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: EXPANSION_MODEL,
        max_completion_tokens: 150,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are a query expansion engine. Given a user's search query, generate 1-2 alternative formulations that might match different phrasings in a knowledge base. " +
              "Return ONLY a JSON array of strings, nothing else. Each string is a complete rephrased query. " +
              "Include the original query as the first element. Example: input 'who founded stripe' → " +
              '["who founded stripe", "Stripe founders", "who created Stripe"].',
          },
          { role: "user", content: safe },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[query-expand] OpenAI error:", res.status);
      return [query];
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return [query];

    const trimmed = raw.trim();
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.length === 0) return [query];

    const valid = parsed
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim())
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, MAX_EXPANDED);

    const result = valid.length > 0 ? valid : [query];
    setCached(query, result);
    return result;
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.warn("[query-expand] Timeout, using original query");
    } else {
      console.error("[query-expand] Expansion error:", err);
    }
    return [query];
  }
}

/** Clear the expansion cache (for testing) */
export function clearExpansionCache(): void {
  CACHE.clear();
}

/** Get cache stats */
export function getExpansionStats(): { size: number; entries: string[] } {
  return {
    size: CACHE.size,
    entries: [...CACHE.keys()].slice(0, 10),
  };
}
