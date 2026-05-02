/**
 * Enrichment Sources — fetch external data about entities.
 *
 * Multi-source architecture:
 *   Brave Search → current web search results (free, 2K queries/month)
 *   OpenAI       → structured template generation
 *
 * Dispatch logic:
 *   Tier 1: Brave (10 results, deep) → OpenAI (full template, 12 sections)
 *   Tier 2: Brave (5 results, quick) → OpenAI (core template, 6 sections)
 *   Tier 3: OpenAI only (LLM knowledge, 3 sections, no web search)
 */

import type { EnrichEntityType, EnrichTier, EnrichSourceData } from "./types";
import { TIER_CONFIGS } from "./types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const BRAVE_API_KEY = process.env.BRAVE_API_KEY || "";

// ── Brave Search ───────────────────────────────────────────────────────

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

/**
 * Research an entity via Brave Search (free web search API).
 * Returns search results formatted as structured text.
 */
export async function fetchFromBrave(
  name: string,
  type: EnrichEntityType,
  tier: EnrichTier,
  context?: string
): Promise<EnrichSourceData | null> {
  if (!BRAVE_API_KEY) {
    console.warn("[enrich] No BRAVE_API_KEY configured — skipping web research");
    return null;
  }

  const query = buildBraveQuery(name, type, context);
  const count = tier === 1 ? 10 : 5;

  try {
    const params = new URLSearchParams({ q: query, count: String(count) });
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": BRAVE_API_KEY,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      console.error(`[enrich] Brave error (${res.status}):`, text.slice(0, 200));
      return null;
    }

    const data = await res.json();
    const results: BraveResult[] = data.web?.results || [];

    if (results.length === 0) {
      console.warn(`[enrich] Brave returned 0 results for "${name}"`);
      return null;
    }

    // Format search results as structured research data
    const content = formatBraveResults(name, results, type);

    return {
      content,
      source: "brave",
      fetchedAt: new Date().toISOString(),
      meta: {
        resultCount: results.length,
        query,
        tier,
        type,
      },
    };
  } catch (err) {
    console.error("[enrich] Brave fetch error:", err);
    return null;
  }
}

function buildBraveQuery(
  name: string,
  type: EnrichEntityType,
  context?: string
): string {
  if (type === "person") {
    // Extract any company hint from context
    const companyHint = context
      ? extractCompanyFromContext(context)
      : "";
    const roleHint = companyHint ? ` ${companyHint}` : "";
    return `${name}${roleHint} biography career profile`;
  }
  return `${name} company profile funding founders`;
}

function extractCompanyFromContext(context: string): string {
  // Quick heuristic: look for "at X" or "CEO of X" patterns
  const atMatch = context.match(/\bat\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/);
  if (atMatch) return atMatch[1];
  const ofMatch = context.match(/(?:CEO|CTO|founder|co-founder|VP|Head)\s+(?:of|at)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/i);
  if (ofMatch) return ofMatch[1];
  return "";
}

function formatBraveResults(
  name: string,
  results: BraveResult[],
  type: EnrichEntityType
): string {
  const lines: string[] = [
    `Web search results for "${name}" (${type}):`,
    "",
  ];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`[${i + 1}] ${r.title}`);
    lines.push(`    URL: ${r.url}`);
    if (r.description) {
      // Clean up description — Brave often returns HTML entities
      const cleanDesc = r.description
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&rdquo;/g, '"')
        .replace(/&ldquo;/g, '"')
        .replace(/&mdash;/g, "—")
        .replace(/&ndash;/g, "–");
      lines.push(`    ${cleanDesc}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── OpenAI (template formatting) ────────────────────────────────────────

/**
 * Generate a structured brain page from research data.
 * Takes Brave search results (or just entity name for Tier 3) and
 * formats it into the GBrain-style page template.
 */
export async function formatWithOpenAI(
  name: string,
  type: EnrichEntityType,
  tier: EnrichTier,
  researchData: string | null,
  context?: string
): Promise<EnrichSourceData> {
  const config = TIER_CONFIGS[tier];
  const prompt = buildFormatPrompt(name, type, tier, researchData, context);

  const content = await callOpenAI(prompt, config.maxTokens, config.model);
  if (!content) {
    throw new Error(`OpenAI formatting failed for "${name}"`);
  }

  return {
    content,
    source: "openai",
    fetchedAt: new Date().toISOString(),
    meta: {
      model: config.model,
      maxTokens: config.maxTokens,
      tier,
      type,
      hadResearchData: !!researchData,
    },
  };
}

function buildFormatPrompt(
  name: string,
  type: EnrichEntityType,
  tier: EnrichTier,
  researchData: string | null,
  context?: string
): string {
  const contextBlock = context
    ? `\nCRITICAL CONTEXT FROM USER (integrate this throughout the dossier — do NOT put it in a separate section):\n${context}\n\nINSTRUCTIONS: Weave the context above naturally into the relevant sections below. Do NOT create a separate "Relationship" or "Context" section. If context describes the person's role, put it in State. If it describes their personality, put it in Assessment. If it describes their work, put it in What They're Building.\n`
    : "";

  const researchBlock = researchData
    ? `\nRESEARCH DATA (from live web search — use this as your primary source):\n${researchData}\n\nIMPORTANT: Use the research data above. These are current web search results with URLs. Prefer them over your training data when they conflict. Extract facts, dates, and names from these snippets.\n`
    : `\nNOTE: No live web research was available. Use your training knowledge for ${name}. Mark uncertain claims with [Unverified] and unknown info with [No data yet].\n`;

  const sectionSpec = type === "person"
    ? getPersonSectionSpec(tier)
    : getCompanySectionSpec(tier);

  return `You are an intelligence analyst generating a structured dossier.

Generate a dossier for: ${name}
Entity type: ${type}
${contextBlock}${researchBlock}

OUTPUT FORMAT — respond with these sections exactly:

${sectionSpec}

RULES:
- Every fact must be verifiable. Prefer the research data above.
- If uncertain, mark with [Unverified].
- Include specific dates where known (YYYY-MM-DD format).
- For the Timeline section, list key events in reverse chronological order.
- Do NOT wrap in JSON or markdown code blocks. Just output sections with ## headers.`;
}

// ── OpenAI API call ─────────────────────────────────────────────────────

async function callOpenAI(
  prompt: string,
  maxTokens: number,
  model: string
): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    console.error("[enrich] No OPENAI_API_KEY configured");
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
        model,
        messages: [
          {
            role: "system",
            content:
              "You are an intelligence analyst. Provide factual, well-sourced information. Never fabricate. Use [No data yet] when uncertain. Follow the output format exactly.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: maxTokens,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      console.error("[enrich] OpenAI error:", err.error?.message || res.statusText);
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("[enrich] OpenAI fetch error:", err);
    return null;
  }
}

// ── Section specs ───────────────────────────────────────────────────────

function getPersonSectionSpec(tier: EnrichTier): string {
  const all = `## Executive Summary
(1 paragraph: who they are, why they matter, current role/company)

## State
(Role, company, location, key metrics. Hard facts only.)

## What They Believe
(Ideology, first principles, worldview. What hills do they die on?)

## What They're Building
(Current projects, recent launches, focus areas.)

## What Motivates Them
(Ambition, career arc, what drives them.)

## Hobby Horses
(Topics they return to obsessively. Recurring themes.)

## Assessment
(Your read: strengths, gaps, trajectory. Ascending/plateauing/pivoting?)

## Network
(Key connections, organizational relationships, notable associations.)

## Contact
(Public contact info, social handles, preferred channels.)`;

  if (tier === 3) {
    return `## Executive Summary
(1 paragraph: who they are, why they matter, current role/company)

## State
(Role, company, location. Hard facts only.)

## Assessment
(Your read: strengths, gaps, trajectory.)`;
  }

  if (tier === 2) {
    return `## Executive Summary
(1 paragraph: who they are, why they matter, current role/company)

## State
(Role, company, location. Hard facts only.)

## What They're Building
(Current projects, recent launches, focus areas.)

## Assessment
(Your read: strengths, gaps, trajectory.)`;
  }

  return all;
}

function getCompanySectionSpec(tier: EnrichTier): string {
  const all = `## Executive Summary
(1 paragraph: what they do, stage, key differentiator.)

## State
(Industry, stage, funding, headcount, key metrics. Hard facts.)

## Key People
(Founders, executives, key hires with roles.)

## Products
(Core products, recent launches, technology stack.)

## Market Position
(Competitors, market share, differentiation.)

## Open Threads
(Active items, pending decisions, things to track.)`;

  if (tier === 3) {
    return `## Executive Summary
(1 paragraph: what they do, stage, key differentiator.)

## State
(Industry, stage, funding. Hard facts.)`;
  }

  if (tier === 2) {
    return `## Executive Summary
(1 paragraph: what they do, stage, key differentiator.)

## State
(Industry, stage, funding, headcount. Hard facts.)

## Key People
(Founders, executives with roles.)

## Products
(Core products, recent launches.)`;
  }

  return all;
}
