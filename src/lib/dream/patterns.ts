/**
 * Dream Cycle Phase 6: Patterns
 * Cross-session theme detection using LLM.
 *
 * Scans recent dream-generated pages (or all pages updated in the last
 * lookback window), sends content to GPT-5.4-nano for recurring theme
 * detection, and writes pattern/concept pages for discovered themes.
 *
 * GBrain v0.25 — phase 6 of the 8-phase dream cycle.
 */

import { queryOne, queryMany } from "../supabase/client";
import type { DreamPhaseResult } from "../dream-cycle";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const PATTERN_MODEL = "gpt-5.4-nano";

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_MIN_EVIDENCE = 2;

// ── OpenAI helper ───────────────────────────────────────────────────────────

async function callOpenAIChat(
  messages: Array<{ role: string; content: string }>,
  maxCompletionTokens = 4096,
): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    console.error("[dream:patterns] No OPENAI_API_KEY configured");
    return null;
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: PATTERN_MODEL,
        messages,
        max_completion_tokens: maxCompletionTokens,
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      console.error("[dream:patterns] OpenAI error:", err.error?.message || res.statusText);
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("[dream:patterns] OpenAI fetch error:", err);
    return null;
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

interface SessionPage {
  slug: string;
  title: string;
  compiled_truth: string;
  type: string;
  updated_at: string;
}

interface DetectedPattern {
  theme: string;
  description: string;
  evidenceSlugs: string[];
  confidence: number;
  suggestedSlug: string;
}

// ── Page query ──────────────────────────────────────────────────────────────

/**
 * Fetch candidate pages for pattern detection.
 * Prefers dream-generated pages; falls back to any recently updated pages
 * if fewer than minEvidence dream-generated pages exist.
 */
async function fetchCandidatePages(
  brainId: string,
  lookbackDays: number,
): Promise<SessionPage[]> {
  const cutoff = `${lookbackDays} days`;

  // First, try dream-generated pages
  const dreamPages = await queryMany<SessionPage>(
    `SELECT slug, title, compiled_truth, type, updated_at::text
     FROM pages
     WHERE brain_id = $1
       AND updated_at > NOW() - INTERVAL '${cutoff}'
       AND (frontmatter->>'dream_generated')::boolean = true
     ORDER BY updated_at DESC
     LIMIT 100`,
    [brainId],
  );

  if (dreamPages.length >= 3) {
    return dreamPages;
  }

  // Fall back to any recently updated pages
  const allPages = await queryMany<SessionPage>(
    `SELECT slug, title, compiled_truth, type, updated_at::text
     FROM pages
     WHERE brain_id = $1
       AND updated_at > NOW() - INTERVAL '${cutoff}'
       AND compiled_truth IS NOT NULL
       AND compiled_truth != ''
     ORDER BY updated_at DESC
     LIMIT 100`,
    [brainId],
  );

  return allPages;
}

// ── Pattern detection ───────────────────────────────────────────────────────

/**
 * Use LLM to detect recurring themes across multiple sessions.
 */
async function detectThemes(
  pages: SessionPage[],
  minEvidence: number,
): Promise<DetectedPattern[]> {
  if (pages.length < minEvidence) return [];

  // Build a context string of page slugs and their summaries
  const pageContext = pages
    .map(
      (p, i) =>
        `[${i}] slug: ${p.slug}\n    title: ${p.title}\n    type: ${p.type}\n    content: ${p.compiled_truth.slice(0, 500)}`,
    )
    .join("\n\n");

  const systemPrompt = `You are a cross-session theme detector for a personal knowledge graph.

Given a set of pages from recent sessions, identify **recurring themes** — concepts,
topics, people, projects, or ideas that appear across multiple sessions.

Rules:
- A theme must be supported by at least ${minEvidence} distinct session pages (provide their slugs as evidence).
- Focus on meaningful patterns: recurring decisions, shifting priorities, persistent challenges, emerging projects.
- Do NOT flag trivial co-occurrences or noise.
- For each theme, provide a concise title, a 1-2 sentence description of the pattern, the evidence slugs, and a confidence score (0-1).
- Also provide a suggested slug for a pattern page (e.g., "patterns/ai-agent-adoption").

Respond with a JSON array in this exact format:
[
  {
    "theme": "AI Agent Adoption",
    "description": "Multiple sessions show growing interest in AI agents for customer support and internal tooling.",
    "evidenceSlugs": ["sessions/2024-03-15", "sessions/2024-03-20", "sessions/2024-03-28"],
    "confidence": 0.85,
    "suggestedSlug": "patterns/ai-agent-adoption"
  }
]

Only return a JSON array. No preamble, no explanation.`;

  const result = await callOpenAIChat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: pageContext },
    ],
    4096,
  );

  if (!result) return [];

  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[dream:patterns] Could not extract JSON array from response");
      return [];
    }
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: DetectedPattern) =>
        p.theme && p.evidenceSlugs && p.evidenceSlugs.length >= minEvidence,
    );
  } catch (err) {
    console.error("[dream:patterns] Failed to parse pattern JSON:", err);
    return [];
  }
}

// ── Pattern page writing ────────────────────────────────────────────────────

async function writePatternPage(
  brainId: string,
  pattern: DetectedPattern,
): Promise<boolean> {
  const content = `# ${pattern.theme}

${pattern.description}

## Evidence

${pattern.evidenceSlugs.map((s) => `- [[${s}]]`).join("\n")}

## Meta

- **Confidence:** ${(pattern.confidence * 100).toFixed(0)}%
- **Evidence count:** ${pattern.evidenceSlugs.length}
- **Generated:** pattern detection (dream cycle phase 6)
`;

  try {
    await queryOne(
      `INSERT INTO pages (brain_id, slug, title, type, compiled_truth, frontmatter, search_vector, written_by)
       VALUES ($1, $2, $3, 'concept', $4, $5::jsonb, to_tsvector('english', $4), 'dream')
       ON CONFLICT (brain_id, slug) DO UPDATE
         SET title = EXCLUDED.title,
             compiled_truth = EXCLUDED.compiled_truth,
             frontmatter = EXCLUDED.frontmatter,
             search_vector = EXCLUDED.search_vector,
             updated_at = NOW()`,
      [
        brainId,
        pattern.suggestedSlug,
        pattern.theme,
        content,
        JSON.stringify({
          dream_generated: true,
          pattern_confidence: pattern.confidence,
          pattern_evidence_count: pattern.evidenceSlugs.length,
          pattern_evidence_slugs: pattern.evidenceSlugs,
        }),
      ],
    );
    return true;
  } catch (err) {
    console.error(`[dream:patterns] Failed to write pattern page ${pattern.suggestedSlug}:`, err);
    return false;
  }
}

// ── Main phase function ─────────────────────────────────────────────────────

export async function detectDreamPatterns(
  brainId: string,
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS,
  minEvidence: number = DEFAULT_MIN_EVIDENCE,
): Promise<DreamPhaseResult> {
  const start = Date.now();

  try {
    // Fetch candidate pages
    const pages = await fetchCandidatePages(brainId, lookbackDays);

    if (pages.length < minEvidence) {
      return {
        phase: "patterns",
        status: "skipped",
        summary: `Only ${pages.length} candidate pages found (need >= ${minEvidence})`,
        duration_ms: Date.now() - start,
        details: { candidatePages: pages.length, minEvidence, lookbackDays },
      };
    }

    // Detect recurring themes via LLM
    const patterns = await detectThemes(pages, minEvidence);

    if (patterns.length === 0) {
      return {
        phase: "patterns",
        status: "skipped",
        summary: `No recurring themes detected across ${pages.length} pages`,
        duration_ms: Date.now() - start,
        details: { candidatePages: pages.length, patternsDetected: 0, lookbackDays },
      };
    }

    // Write pattern pages
    let pagesWritten = 0;
    for (const pattern of patterns) {
      const written = await writePatternPage(brainId, pattern);
      if (written) pagesWritten++;
    }

    const duration = Date.now() - start;
    return {
      phase: "patterns",
      status: "completed",
      summary: `Detected ${patterns.length} cross-session pattern(s), wrote ${pagesWritten} page(s) across ${pages.length} candidate pages`,
      duration_ms: duration,
      details: {
        candidatePages: pages.length,
        patternsDetected: patterns.length,
        pagesWritten,
        lookbackDays,
        minEvidence,
        patterns: patterns.map((p) => ({
          theme: p.theme,
          evidenceCount: p.evidenceSlugs.length,
          confidence: p.confidence,
        })),
      },
    };
  } catch (err) {
    return {
      phase: "patterns",
      status: "failed",
      summary: "Pattern detection failed",
      duration_ms: Date.now() - start,
      details: { error: String(err) },
    };
  }
}
