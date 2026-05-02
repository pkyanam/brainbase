/**
 * Enrichment Sources — fetch external data about entities.
 *
 * Multi-source architecture:
 *   Perplexity → current web research with citations
 *   OpenAI     → structured template generation
 *
 * Dispatch logic:
 *   Tier 1: Perplexity (sonar-pro) → OpenAI (full template, 12 sections)
 *   Tier 2: Perplexity (sonar) → OpenAI (core template, 6 sections)
 *   Tier 3: OpenAI only (LLM knowledge, 3 sections, no web search)
 */

import type { EnrichEntityType, EnrichTier, EnrichSourceData } from "./types";
import { TIER_CONFIGS } from "./types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || "";

// ── Perplexity ──────────────────────────────────────────────────────────

/**
 * Research an entity via Perplexity (live web search).
 * Returns raw search results — unstructured but current and cited.
 */
export async function fetchFromPerplexity(
  name: string,
  type: EnrichEntityType,
  tier: EnrichTier,
  context?: string
): Promise<EnrichSourceData | null> {
  if (!PERPLEXITY_API_KEY) {
    console.warn("[enrich] No PERPLEXITY_API_KEY configured — skipping web research");
    return null;
  }

  const model = tier === 1 ? "sonar-pro" : "sonar";
  const prompt = buildPerplexityPrompt(name, type, tier, context);

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a research analyst. Provide accurate, current information with specific dates, names, and metrics. Be thorough and factual.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: tier === 1 ? 4096 : 2048,
        temperature: 0.1,
        return_citations: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      console.error(`[enrich] Perplexity error (${res.status}):`, err.error?.message || res.statusText);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || null;
    const citations = data.citations || [];

    if (!content) return null;

    // Append citation URLs
    let finalContent = content;
    if (citations.length > 0) {
      finalContent += "\n\n## Sources\n";
      citations.forEach((url: string, i: number) => {
        finalContent += `- [${i + 1}] ${url}`;
      });
    }

    return {
      content: finalContent,
      source: "perplexity",
      fetchedAt: new Date().toISOString(),
      meta: { model, citationsCount: citations.length, tier, type },
    };
  } catch (err) {
    console.error("[enrich] Perplexity fetch error:", err);
    return null;
  }
}

function buildPerplexityPrompt(
  name: string,
  type: EnrichEntityType,
  tier: EnrichTier,
  context?: string
): string {
  const contextLine = context
    ? `\nAdditional context: ${context}\n`
    : "";

  const depth = tier === 1
    ? "very thorough and detailed"
    : "concise but informative";

  if (type === "person") {
    return `Research ${name} and provide a ${depth} profile.${contextLine}

Include (where available):
- Current role, company, location
- Career history and major achievements
- Education background
- Public statements, beliefs, or philosophy
- Recent projects, launches, or initiatives
- Public controversies or notable events
- Social media presence and handle
- Books, essays, or talks they've authored
- Key professional relationships and network
- Funding raised (if founder/investor)
- Boards or advisory roles

Format as a structured report. Include specific dates (YYYY-MM-DD) and verifiable facts. If information is uncertain or disputed, note that explicitly.`;
  }

  return `Research ${name} (the company/organization) and provide a ${depth} profile.${contextLine}

Include (where available):
- What they do and their core product/service
- Founding date, founders, and origin story
- Funding history (rounds, amounts, investors, dates)
- Current stage, headcount, and revenue estimates
- Key executives and their backgrounds
- Major product launches and milestones
- Market position and primary competitors
- Technology stack or technical approach
- Recent news, pivots, or controversies
- Business model and customer base
- Notable partnerships or acquisitions

Format as a structured report. Include specific dates (YYYY-MM-DD) and verifiable facts. If information is uncertain or disputed, note that explicitly.`;
}

// ── OpenAI (template formatting) ────────────────────────────────────────

/**
 * Generate a structured brain page from research data.
 * Takes Perplexity output (or just entity name for Tier 3) and
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
    ? `\nRESEARCH DATA (from live web search — use this as your primary source):\n${researchData}\n\nIMPORTANT: Use the research data above. It is current and sourced from the web. Prefer it over your training data when they conflict.\n`
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
- Do NOT wrap in JSON or markdown code blocks. Just output sections with ## headers.
- Keep the full response under ${type === "person" ? "8" : "5"} sections.`;
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

// ── Section specs (moved from old buildEnrichPrompt) ────────────────────

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
