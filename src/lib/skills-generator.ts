import { searchBrain } from "./supabase/search";
import { getPage, getPageLinks, getTimeline } from "./supabase/pages";
import { queryMany } from "./supabase/client";

export interface SkillsFile {
  task: string;
  confidence: number;
  sources: string[];
  generatedAt: string;
  people: {
    name: string;
    role: string;
    slackHandle?: string;
    email?: string;
    involvement: "owner" | "approver" | "informed";
  }[];
  rules: {
    condition: string;
    action: string;
    owner?: string;
    precedents: number;
    confidence: number;
    sources: string[];
  }[];
  implicitRules: {
    observation: string;
    evidence: string;
    confidence: number;
  }[];
  precedents: {
    date: string;
    summary: string;
    outcome: string;
    confidence: number;
  }[];
  exceptions: {
    condition: string;
    handling: string;
    source: string;
  }[];
}

interface TraversedNode {
  slug: string;
  title: string;
  type: string;
  content: string;
  depth: number;
  sources: string[];
}

/**
 * Generate a SkillsFile for a given task by traversing the brain graph.
 * Deterministic — no LLM calls, works offline, fast.
 */
export async function generateSkillsFile(
  brainId: string,
  task: string
): Promise<SkillsFile> {
  const startTime = Date.now();

  // 1. Search for seed pages related to the task
  const searchResults = await searchBrain(brainId, task, 10);
  const seedSlugs = searchResults.map((r) => r.slug);

  if (seedSlugs.length === 0) {
    return {
      task,
      confidence: 0,
      sources: [],
      generatedAt: new Date().toISOString(),
      people: [],
      rules: [],
      implicitRules: [],
      precedents: [],
      exceptions: [],
    };
  }

  // 2. Traverse graph 2 hops from seeds
  const visited = new Map<string, TraversedNode>();
  const queue: { slug: string; depth: number; source: string }[] = seedSlugs.map(
    (s) => ({ slug: s, depth: 0, source: "search" })
  );

  while (queue.length > 0) {
    const { slug, depth, source } = queue.shift()!;
    if (visited.has(slug)) {
      const existing = visited.get(slug)!;
      if (!existing.sources.includes(source)) existing.sources.push(source);
      continue;
    }
    if (depth > 2) continue;

    const page = await getPage(brainId, slug);
    if (!page) continue;

    visited.set(slug, {
      slug,
      title: page.title,
      type: page.type,
      content: page.content.slice(0, 2000),
      depth,
      sources: [source],
    });

    // Get links and enqueue neighbors
    const links = await getPageLinks(brainId, slug);
    for (const l of links.outgoing) {
      if (!visited.has(l.slug)) {
        queue.push({ slug: l.slug, depth: depth + 1, source: slug });
      }
    }
    for (const l of links.incoming) {
      if (!visited.has(l.slug)) {
        queue.push({ slug: l.slug, depth: depth + 1, source: slug });
      }
    }
  }

  // 3. Extract people
  const peopleNodes = Array.from(visited.values()).filter(
    (n) => n.type === "person"
  );
  const people = peopleNodes.map((n) => ({
    name: n.title,
    role: inferRole(n.content, n.slug),
    slackHandle: extractHandle(n.content, "slack") || undefined,
    email: extractHandle(n.content, "email") || undefined,
    involvement: inferInvolvement(n, seedSlugs, brainId) as "owner" | "approver" | "informed",
  }));

  // 4. Extract rules from concept/decision pages
  const conceptNodes = Array.from(visited.values()).filter(
    (n) => n.type === "concept" || n.type === "decision" || n.type === "policy"
  );
  const rules: SkillsFile["rules"] = [];
  for (const node of conceptNodes) {
    const timeline = await getTimeline(brainId, node.slug);
    const extracted = extractRulesFromContent(node.content, node.slug, timeline);
    rules.push(...extracted);
  }

  // 5. Extract precedents from timeline entries
  const precedents: SkillsFile["precedents"] = [];
  for (const node of Array.from(visited.values())) {
    const timeline = await getTimeline(brainId, node.slug);
    for (const t of timeline) {
      const outcome = inferOutcome(t.summary);
      precedents.push({
        date: t.date,
        summary: t.summary,
        outcome,
        confidence: t.source ? 0.9 : 0.7,
      });
    }
  }

  // 6. Detect implicit rules (repeated patterns with no explicit source)
  const implicitRules = detectImplicitRules(rules, precedents);

  // 7. Extract exceptions
  const exceptions = extractExceptions(Array.from(visited.values()));

  // 8. Compute overall confidence
  const sourceSet = new Set<string>();
  for (const n of visited.values()) {
    if (n.type === "slack") sourceSet.add("slack");
    else if (n.type === "email") sourceSet.add("email");
    else if (n.type === "linear") sourceSet.add("linear");
    else sourceSet.add("docs");
  }

  const ruleConfidence =
    rules.length > 0
      ? rules.reduce((s, r) => s + r.confidence, 0) / rules.length
      : 0;
  const precedentConfidence =
    precedents.length > 0
      ? precedents.reduce((s, p) => s + p.confidence, 0) / precedents.length
      : 0;
  const overallConfidence =
    visited.size > 0
      ? Math.min(
          0.98,
          0.3 + ruleConfidence * 0.4 + precedentConfidence * 0.3
        )
      : 0;

  console.log(
    `[brainbase] SkillsFile generated for "${task}" in ${Date.now() - startTime}ms — ${visited.size} nodes, ${rules.length} rules, ${precedents.length} precedents`
  );

  return {
    task,
    confidence: Math.round(overallConfidence * 100) / 100,
    sources: Array.from(sourceSet),
    generatedAt: new Date().toISOString(),
    people: people.slice(0, 10),
    rules: rules.slice(0, 10),
    implicitRules: implicitRules.slice(0, 5),
    precedents: precedents.slice(0, 15),
    exceptions: exceptions.slice(0, 5),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

function inferRole(content: string, slug: string): string {
  const lower = content.toLowerCase();
  if (lower.includes("sales")) return "Sales";
  if (lower.includes("legal")) return "Legal";
  if (lower.includes("finance")) return "Finance";
  if (lower.includes("engineer")) return "Engineering";
  if (lower.includes("product")) return "Product";
  if (lower.includes("ceo") || lower.includes("founder")) return "Executive";
  if (lower.includes("customer success")) return "Customer Success";
  return slug.includes("-") ? slug.split("-")[0] : "Team Member";
}

function extractHandle(content: string, type: "slack" | "email"): string | null {
  if (type === "email") {
    const match = content.match(/[\w.-]+@[\w.-]+\.\w+/);
    return match?.[0] || null;
  }
  if (type === "slack") {
    const match = content.match(/@[\w.]+/);
    return match?.[0] || null;
  }
  return null;
}

function inferInvolvement(
  node: TraversedNode,
  seeds: string[],
  brainId: string
): string {
  // Directly linked to a seed = owner
  if (seeds.includes(node.slug)) return "owner";
  // Has many links = approver
  if (node.content.toLowerCase().includes("approve")) return "approver";
  return "informed";
}

function extractRulesFromContent(
  content: string,
  slug: string,
  timeline: { date: string; summary: string }[]
): SkillsFile["rules"] {
  const rules: SkillsFile["rules"] = [];
  const lower = content.toLowerCase();

  // Pattern: "if X then Y"
  const ifMatches = content.match(/if\s+(.+?)[,.]?\s+then\s+(.+?)(?:\.|\n|$)/gi);
  if (ifMatches) {
    for (const m of ifMatches) {
      const parts = m.match(/if\s+(.+?)[,.]?\s+then\s+(.+)/i);
      if (parts) {
        rules.push({
          condition: parts[1].trim(),
          action: parts[2].trim(),
          precedents: timeline.length,
          confidence: Math.min(0.95, 0.6 + timeline.length * 0.05),
          sources: [slug],
        });
      }
    }
  }

  // Pattern: "$N threshold"
  const thresholdMatches = content.match(/\$[\d,.]+[KkMm]?\+?\s*(threshold|limit|cap|minimum|maximum)/gi);
  if (thresholdMatches) {
    for (const m of thresholdMatches) {
      const numMatch = m.match(/\$[\d,.]+[KkMm]?/);
      if (numMatch) {
        rules.push({
          condition: `Deal value ${numMatch[0]}`,
          action: extractActionAround(content, numMatch[0]),
          precedents: timeline.length,
          confidence: Math.min(0.92, 0.65 + timeline.length * 0.04),
          sources: [slug],
        });
      }
    }
  }

  // Pattern: "requires approval from X"
  const approvalMatches = content.match(/requires?\s+(?:approval|review)\s+from\s+(.+?)(?:\.|\n|$)/gi);
  if (approvalMatches) {
    for (const m of approvalMatches) {
      const parts = m.match(/requires?\s+(?:approval|review)\s+from\s+(.+)/i);
      if (parts) {
        rules.push({
          condition: "Approval required",
          action: `Get approval from ${parts[1].trim()}`,
          owner: parts[1].trim().split(/\s+/).slice(0, 2).join(" "),
          precedents: timeline.length,
          confidence: Math.min(0.94, 0.7 + timeline.length * 0.04),
          sources: [slug],
        });
      }
    }
  }

  // Fallback: if content looks like a policy but no patterns matched
  if (rules.length === 0 && lower.includes("policy") || lower.includes("process") || lower.includes("rule")) {
    rules.push({
      condition: "General policy",
      action: content.slice(0, 200).replace(/\n/g, " "),
      precedents: timeline.length,
      confidence: 0.5,
      sources: [slug],
    });
  }

  return rules;
}

function extractActionAround(content: string, keyword: string): string {
  const idx = content.indexOf(keyword);
  if (idx < 0) return "Follow standard process";
  const start = Math.max(0, idx - 80);
  const end = Math.min(content.length, idx + keyword.length + 120);
  return content.slice(start, end).replace(/\n/g, " ").trim();
}

function inferOutcome(summary: string): string {
  const lower = summary.toLowerCase();
  if (lower.includes("approved")) return "Approved";
  if (lower.includes("denied") || lower.includes("rejected")) return "Denied";
  if (lower.includes("escalated")) return "Escalated";
  if (lower.includes("pending")) return "Pending";
  return "Documented";
}

function detectImplicitRules(
  rules: SkillsFile["rules"],
  precedents: SkillsFile["precedents"]
): SkillsFile["implicitRules"] {
  const implicit: SkillsFile["implicitRules"] = [];

  // Look for rules with high precedent count but low explicit documentation
  const undocumentedRules = rules.filter(
    (r) => r.precedents > 3 && r.confidence > 0.8 && !r.action.toLowerCase().includes("documented")
  );

  for (const r of undocumentedRules) {
    implicit.push({
      observation: `${r.condition} consistently results in: ${r.action}`,
      evidence: `${r.precedents} precedent decisions support this pattern`,
      confidence: Math.round(r.confidence * 100) / 100,
    });
  }

  // Detect threshold gaps (e.g., $50K and $100K rules but nothing in between)
  const thresholds = rules
    .map((r) => {
      const m = r.condition.match(/\$([\d,.]+)([KkMm])?/);
      if (!m) return null;
      let val = parseFloat(m[1].replace(/,/g, ""));
      if (m[2]?.toLowerCase() === "k") val *= 1000;
      if (m[2]?.toLowerCase() === "m") val *= 1000000;
      return { val, rule: r };
    })
    .filter(Boolean) as { val: number; rule: SkillsFile["rules"][0] }[];

  if (thresholds.length >= 2) {
    thresholds.sort((a, b) => a.val - b.val);
    for (let i = 0; i < thresholds.length - 1; i++) {
      const gap = thresholds[i + 1].val - thresholds[i].val;
      if (gap > thresholds[i].val * 0.5) {
        implicit.push({
          observation: `No documented process for deals between ${thresholds[i].rule.condition} and ${thresholds[i + 1].rule.condition}`,
          evidence: "Gap in documented thresholds",
          confidence: 0.75,
        });
      }
    }
  }

  return implicit;
}

function extractExceptions(nodes: TraversedNode[]): SkillsFile["exceptions"] {
  const exceptions: SkillsFile["exceptions"] = [];

  for (const node of nodes) {
    const lower = node.content.toLowerCase();
    if (
      lower.includes("exception") ||
      lower.includes("bypass") ||
      lower.includes("override") ||
      lower.includes("unless")
    ) {
      const sentences = node.content.split(/[.!?]+/);
      for (const s of sentences) {
        const sl = s.toLowerCase();
        if (
          sl.includes("exception") ||
          sl.includes("bypass") ||
          sl.includes("override") ||
          sl.includes("unless")
        ) {
          exceptions.push({
            condition: s.trim().slice(0, 120),
            handling: "See source for full details",
            source: node.slug,
          });
        }
      }
    }
  }

  return exceptions;
}
