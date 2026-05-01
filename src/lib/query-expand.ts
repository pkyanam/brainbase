/**
 * Multi-query expansion — LLM-powered query reformulation.
 * GBrain v0.25 parity: uses Haiku (gpt-5.4-nano here) to generate
 * 2-3 alternative query formulations, then each is searched independently
 * and results merged via RRF.
 *
 * Prompt-injection defense: queries are sanitized before being sent to the LLM.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const EXPANSION_MODEL = "gpt-5.4-nano";

/**
 * Sanitize a query string for safe interpolation into an LLM prompt.
 * Strips quotes, backticks, null bytes, and escape sequences that could
 * break out of the prompt template.
 */
export function sanitizeQueryForPrompt(query: string): string {
  return query
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // control chars
    .replace(/["`'\\]/g, "")                             // quotes + backslash
    .replace(/--/g, "-")                                 // SQL comment guard
    .replace(/\/\*/g, "")                                // SQL block comment
    .trim()
    .slice(0, 500);                                      // hard cap
}

/**
 * Generate 2-3 alternative query formulations using an LLM.
 * Returns the original query plus alternatives, or just the original on error.
 */
export async function expandQueries(query: string): Promise<string[]> {
  if (!OPENAI_API_KEY || !query.trim()) return [query];

  const safe = sanitizeQueryForPrompt(query);
  if (!safe) return [query];

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: EXPANSION_MODEL,
        max_completion_tokens: 200,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are a query expansion engine. Given a user's search query, generate 2-3 alternative formulations that might match different phrasings in a knowledge base. " +
              "Return ONLY a JSON array of strings, nothing else. Each string is a complete rephrased query. " +
              "Include the original query as the first element. Example: input 'who founded stripe' → " +
              '["who founded stripe", "Stripe founders", "Stripe founding team", "who created Stripe"].',
          },
          {
            role: "user",
            content: safe,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[query-expand] OpenAI error:", res.status);
      return [query];
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return [query];

    // Parse the JSON array
    const trimmed = raw.trim();
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.length === 0) return [query];

    // Validate: all strings, dedup, limit to 4 max
    const valid = parsed
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim())
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 4);

    return valid.length > 0 ? valid : [query];
  } catch (err) {
    console.error("[query-expand] Expansion error:", err);
    return [query]; // graceful fallback
  }
}
