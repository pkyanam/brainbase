/**
 * Ask Engine — Natural language Q&A over the brain.
 *
 * Pipeline:
 *   1. Hybrid search (same as /api/query)
 *   2. Fetch full content for top results
 *   3. LLM summarization with citations
 *
 * No graph crawling. No regex extraction. Just search + read + answer.
 * Every phase has its own try/catch — askBrain NEVER throws.
 */

import {
  searchBrain,
  vectorSearchBrain,
  expandQuery,
  SearchResult,
} from "./supabase/search";
import { generateEmbeddings } from "./embeddings";
import { queryMany } from "./supabase/client";
import {
  rrfFusion,
  dedupBySlug,
  pinExactMatches,
  forceExactMatchTopFinal,
  normalizeScores,
  applyCompiledTruthBoost,
  applyBacklinkBoost,
  applyTweetBoost,
  classifyIntent,
  detailForIntent,
  QueryIntent,
  BoostFactors,
} from "./supabase/hybrid";
import { classifyIntentLLM } from "./intent-classifier";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ASK_MODEL = "gpt-5.4-nano";

export interface AskResult {
  answer: string;
  sources: {
    slug: string;
    title: string;
    type: string;
    excerpt: string;
    relevance: number;
  }[];
  confidence: number;
  intent: QueryIntent;
  searchedAt: string;
}

interface SearchOutput {
  slug: string;
  title: string;
  type: string;
  excerpt: string;
  score: number;
  boost_factors?: BoostFactors | null;
}

/**
 * Run hybrid search identical to /api/query.
 * Never throws — returns empty array on any failure.
 */
async function runHybridSearch(
  brainId: string,
  q: string,
  limit: number
): Promise<SearchOutput[]> {
  try {
    const intent: QueryIntent = (await classifyIntentLLM(q, classifyIntent)) as QueryIntent;
    const detail = detailForIntent(intent);

    const keywordLimit = detail === "high" ? limit * 3 : limit * 2;
    const expandedQ = expandQuery(q);

    const [keywordResults, embedding] = await Promise.all([
      searchBrain(brainId, q, keywordLimit),
      generateEmbeddings([expandedQ]).then((e) => e?.[0] ?? null),
    ]);

    let vectorResults: SearchResult[] = [];
    if (embedding) {
      vectorResults = await vectorSearchBrain(brainId, embedding, keywordLimit);
    }

    const dedupedVector = dedupBySlug(vectorResults);
    const pinnedKeyword = pinExactMatches(keywordResults, q);
    const pinnedVector = pinExactMatches(dedupedVector, q);

    const fused = rrfFusion([pinnedKeyword, pinnedVector]);
    const normed = normalizeScores(fused);

    applyCompiledTruthBoost(normed);

    const slugs = Array.from(normed.keys());
    const backlinks = await fetchBacklinks(brainId, slugs);
    applyBacklinkBoost(normed, backlinks);

    // Flatten → dedup
    const allResults: Array<{
      slug: string;
      score: number;
      excerpt: string;
      type: string;
      source: string;
      title: string;
      boost_factors?: BoostFactors;
    }> = [];

    for (const [slug, entry] of normed) {
      for (const r of entry.results) {
        allResults.push({
          slug,
          score: entry.score,
          excerpt: r.excerpt,
          type: r.type,
          source: r.source,
          title: r.title,
          boost_factors: (entry as any).boost_factors,
        });
      }
    }

    const finalResults = dedupBySlug(allResults);
    applyTweetBoost(finalResults as any, intent);
    forceExactMatchTopFinal(finalResults, q);

    finalResults.sort((a, b) => b.score - a.score);

    return finalResults.slice(0, limit).map((r) => ({
      slug: r.slug,
      title: r.title,
      type: r.type || "page",
      excerpt: r.excerpt,
      score: Math.round(r.score * 100) / 100,
      boost_factors: (r as any).boost_factors || null,
    }));
  } catch (err) {
    console.error("[brainbase] ask-engine: search phase failed:", err);
    return [];
  }
}

/**
 * Fetch full page content for summarization context.
 * Never throws — returns partial map on failure.
 */
async function fetchPageContents(
  brainId: string,
  slugs: string[]
): Promise<Map<string, { title: string; content: string; type: string }>> {
  if (slugs.length === 0) return new Map();

  try {
    const rows = await queryMany<{
      slug: string;
      title: string;
      content: string;
      type: string;
    }>(
      `SELECT slug, title, COALESCE(content, compiled_truth, '') as content, type
       FROM pages
       WHERE brain_id = $1 AND slug = ANY($2)`,
      [brainId, slugs]
    );

    const map = new Map<string, { title: string; content: string; type: string }>();
    for (const r of rows) {
      map.set(r.slug, { title: r.title, content: r.content, type: r.type });
    }
    return map;
  } catch (err) {
    console.error("[brainbase] ask-engine: content fetch failed:", err);
    return new Map();
  }
}

/**
 * Generate a natural language answer from search results using an LLM.
 * Never throws — returns graceful fallback on any failure.
 */
async function generateAnswer(
  question: string,
  results: SearchOutput[],
  contents: Map<string, { title: string; content: string; type: string }>
): Promise<{ answer: string; confidence: number }> {
  if (!OPENAI_API_KEY) {
    return {
      answer:
        "I can't generate a summarized answer right now (no LLM API key configured). Here are the most relevant pages I found:",
      confidence: 0,
    };
  }

  if (results.length === 0) {
    return {
      answer:
        "I couldn't find anything in your brain that matches this question. Try rephrasing or check if the information has been imported.",
      confidence: 0,
    };
  }

  // Build context from top results
  const contextParts: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const content = contents.get(r.slug);
    const text = content?.content || r.excerpt || "";
    // Truncate to ~800 chars per source to stay within token budget
    const truncated = text.length > 800 ? text.slice(0, 800) + "..." : text;
    contextParts.push(
      `[${i + 1}] **${r.title}** (${r.type})\n${truncated}`
    );
  }

  const context = contextParts.join("\n\n");

  const systemPrompt = `You are a helpful research assistant with access to the user's personal knowledge base ("brain"). Answer the user's question using ONLY the provided sources. Be concise but thorough. If the sources don't contain the answer, say so honestly. Always cite sources using [1], [2], etc. If the question is about a person, include relevant facts from the sources. Never make up information.`;

  const userPrompt = `Question: ${question}\n\nSources:\n${context}\n\nAnswer:`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: ASK_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_completion_tokens: 600,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      console.error("[brainbase] LLM answer error:", err.error?.message || res.statusText);
      return {
        answer: `I found ${results.length} relevant page(s), but couldn't generate a summary right now.`,
        confidence: 0.3,
      };
    }

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || "";

    // Simple confidence heuristic based on result scores
    const avgScore =
      results.reduce((s, r) => s + r.score, 0) / results.length;
    const confidence = Math.min(0.95, avgScore * 0.8 + 0.1);

    return { answer, confidence };
  } catch (err) {
    console.error("[brainbase] LLM fetch error:", err);
    return {
      answer: `I found ${results.length} relevant page(s), but couldn't generate a summary right now.`,
      confidence: 0.2,
    };
  }
}

/** Fetch backlink counts for a set of slugs. */
async function fetchBacklinks(
  brainId: string,
  slugs: string[]
): Promise<Map<string, number>> {
  if (slugs.length === 0) return new Map();
  try {
    const rows = await queryMany<{ slug: string; count: string }>(
      `SELECT p.slug,
         COALESCE(lc.cnt, 0) as count
       FROM pages p
       LEFT JOIN (
         SELECT to_page_id as pid, COUNT(*) as cnt
         FROM links WHERE brain_id = $1
         GROUP BY to_page_id
       ) lc ON lc.pid = p.id
       WHERE p.brain_id = $1 AND p.slug = ANY($2)`,
      [brainId, slugs]
    );
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.slug, parseInt(r.count) || 0);
    }
    return map;
  } catch (err) {
    console.error("[brainbase] ask-engine: backlink fetch failed:", err);
    return new Map();
  }
}

/**
 * Main entry point: ask a question, get an answer.
 * NEVER THROWS. Always returns a valid AskResult.
 */
export async function askBrain(
  brainId: string,
  question: string,
  limit: number = 5
): Promise<AskResult> {
  const start = Date.now();

  // 1. Search (never throws)
  const results = await runHybridSearch(brainId, question, limit);

  // 2. Fetch full content (never throws)
  const contents = await fetchPageContents(
    brainId,
    results.map((r) => r.slug)
  );

  // 3. Generate answer (never throws)
  const { answer, confidence } = await generateAnswer(
    question,
    results,
    contents
  );

  console.log(
    `[brainbase] askBrain: "${question.slice(0, 40)}..." in ${
      Date.now() - start
    }ms — ${results.length} sources, confidence ${Math.round(
      confidence * 100
    )}%`
  );

  return {
    answer,
    sources: results.map((r) => ({
      slug: r.slug,
      title: r.title,
      type: r.type,
      excerpt: r.excerpt,
      relevance: r.score,
    })),
    confidence,
    intent: (await classifyIntentLLM(question, classifyIntent)) as QueryIntent,
    searchedAt: new Date().toISOString(),
  };
}
