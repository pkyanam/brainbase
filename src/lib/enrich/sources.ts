/**
 * Enrichment Sources — fetch external data about entities.
 *
 * Primary source is OpenAI (gpt-5.4-nano) which has broad knowledge.
 * Pluggable architecture for future sources (Perplexity, Crustdata, etc.).
 */

import type { EnrichEntityType, EnrichTier, EnrichSourceData, TierConfig } from "./types";
import { TIER_CONFIGS } from "./types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

/**
 * Fetch information about an entity from OpenAI.
 * Returns structured raw text that will be templated into a brain page.
 */
export async function fetchFromOpenAI(
  name: string,
  type: EnrichEntityType,
  tier: EnrichTier,
  context?: string
): Promise<EnrichSourceData> {
  const config = TIER_CONFIGS[tier];
  const prompt = buildEnrichPrompt(name, type, tier, context);

  const content = await callOpenAI(prompt, config.maxTokens, config.model);
  if (!content) {
    throw new Error(`OpenAI enrichment failed for "${name}"`);
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
    },
  };
}

/**
 * Build a structured prompt for enrichment.
 * The prompt asks the LLM to generate sections matching the page template.
 */
function buildEnrichPrompt(
  name: string,
  type: EnrichEntityType,
  tier: EnrichTier,
  context?: string
): string {
  const contextBlock = context
    ? `\nCONTEXT FROM USER (why they're relevant, relationship, etc.):\n${context}\n`
    : "";

  if (type === "person") {
    return buildPersonPrompt(name, tier, contextBlock);
  }
  return buildCompanyPrompt(name, tier, contextBlock);
}

function buildPersonPrompt(name: string, tier: EnrichTier, contextBlock: string): string {
  const sectionSpec = getPersonSectionSpec(tier);

  return `You are an intelligence analyst generating a structured dossier on a person. 
Provide FACTUAL information only. If you don't know something, say "[No data yet]" — never fabricate.

Generate a dossier for: ${name}
${contextBlock}

OUTPUT FORMAT — respond with these sections exactly:

${sectionSpec}

RULES:
- Every fact must be verifiable from public information.
- If you're uncertain about any claim, mark it with [Unverified].
- Keep the "Assessment" section concise — your read on this person's trajectory.
- Include specific dates where known (YYYY-MM-DD format).
- For the Timeline section, list 3-8 key events in reverse chronological order.
- Do NOT wrap the response in JSON or markdown code blocks. Just output the sections as plain text with ## headers.`;
}

function buildCompanyPrompt(name: string, tier: EnrichTier, contextBlock: string): string {
  const sectionSpec = getCompanySectionSpec(tier);

  return `You are an intelligence analyst generating a structured dossier on a company.
Provide FACTUAL information only. If you don't know something, say "[No data yet]" — never fabricate.

Generate a dossier for: ${name}
${contextBlock}

OUTPUT FORMAT — respond with these sections exactly:

${sectionSpec}

RULES:
- Every fact must be verifiable from public information.
- If you're uncertain about any claim, mark it with [Unverified].
- Include specific dates where known (YYYY-MM-DD format).
- For the Timeline section, list key funding rounds, product launches, and leadership changes.
- Do NOT wrap the response in JSON or markdown code blocks. Just output the sections as plain text with ## headers.`;
}

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

/**
 * Call OpenAI chat completions API.
 */
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
              "You are a research analyst. Provide factual, well-sourced information. Never fabricate. Use [No data yet] when uncertain.",
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
