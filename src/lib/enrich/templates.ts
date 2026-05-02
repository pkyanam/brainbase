/**
 * Enrichment Templates — format raw enrichment data into brain pages.
 *
 * Takes the raw content from external sources and wraps it into
 * properly-formatted markdown with frontmatter.
 */

import type { EnrichEntityType } from "./types";

export interface TemplateResult {
  /** Full markdown page content with YAML frontmatter */
  content: string;

  /** Extracted title */
  title: string;

  /** Suggested tags */
  tags: string[];

  /** Detected wikilinks (people, companies mentioned in content) */
  detectedEntities: string[];
}

/**
 * Build a person page from enriched content.
 */
export function buildPersonPage(
  name: string,
  enrichedContent: string,
  context?: string
): TemplateResult {
  const title = name.trim();
  const now = new Date().toISOString().split("T")[0];

  // Extract a summary line for the frontmatter description
  const summary = extractSection(enrichedContent, "Executive Summary")
    ?.replace(/^## Executive Summary\s*/i, "")
    ?.trim()
    ?.split("\n")[0]
    ?.slice(0, 200) || `Profile for ${title}`;

  // Detect entities mentioned in the content
  const detectedEntities = extractEntityMentions(enrichedContent, title);

  // Build frontmatter
  const frontmatter = [
    "---",
    `title: "${title}"`,
    "type: person",
    `created: ${now}`,
    `updated: ${now}`,
    `tags: []`,
    `summary: "${escapeYaml(summary)}"`,
    "---",
  ].join("\n");

  // Build body from sections
  const body = buildPersonBody(enrichedContent, context);

  return {
    content: `${frontmatter}\n\n${body}`,
    title,
    tags: suggestTags(enrichedContent, "person"),
    detectedEntities,
  };
}

/**
 * Build a company page from enriched content.
 */
export function buildCompanyPage(
  name: string,
  enrichedContent: string,
  context?: string
): TemplateResult {
  const title = name.trim();
  const now = new Date().toISOString().split("T")[0];

  const summary = extractSection(enrichedContent, "Executive Summary")
    ?.replace(/^## Executive Summary\s*/i, "")
    ?.trim()
    ?.split("\n")[0]
    ?.slice(0, 200) || `Profile for ${title}`;

  const detectedEntities = extractEntityMentions(enrichedContent, title);

  const frontmatter = [
    "---",
    `title: "${title}"`,
    "type: company",
    `created: ${now}`,
    `updated: ${now}`,
    `tags: []`,
    `summary: "${escapeYaml(summary)}"`,
    "---",
  ].join("\n");

  const body = buildCompanyBody(enrichedContent, context);

  return {
    content: `${frontmatter}\n\n${body}`,
    title,
    tags: suggestTags(enrichedContent, "company"),
    detectedEntities,
  };
}

/**
 * Build person page body from enriched sections.
 */
function buildPersonBody(rawContent: string, context?: string): string {
  const parts: string[] = [];

  // Executive Summary always comes first
  const summary = extractSection(rawContent, "Executive Summary");
  if (summary) {
    parts.push(summary.trim());
  }

  // Remaining sections in order
  const sections = [
    "State",
    "What They Believe",
    "What They're Building",
    "What Motivates Them",
    "Hobby Horses",
    "Assessment",
    "Network",
    "Contact",
  ];

  for (const section of sections) {
    const content = extractSection(rawContent, section);
    if (content) {
      parts.push(content.trim());
    }
  }

  // Add user context if provided (as Relationship section)
  if (context) {
    parts.push(
      `## Relationship\n\n${context.trim()}`
    );
  }

  // Add empty Timeline marker — will be populated by subsequent enrichments
  parts.push(
    "## Timeline\n\n*No timeline entries yet. Run a dream cycle to auto-extract dates.*"
  );

  return parts.join("\n\n");
}

/**
 * Build company page body from enriched sections.
 */
function buildCompanyBody(rawContent: string, context?: string): string {
  const parts: string[] = [];

  const summary = extractSection(rawContent, "Executive Summary");
  if (summary) {
    parts.push(summary.trim());
  }

  const sections = ["State", "Key People", "Products", "Market Position"];

  for (const section of sections) {
    const content = extractSection(rawContent, section);
    if (content) {
      parts.push(content.trim());
    }
  }

  if (context) {
    parts.push(`## Relationship\n\n${context.trim()}`);
  }

  const openThreads = extractSection(rawContent, "Open Threads");
  if (openThreads) {
    parts.push(openThreads.trim());
  } else {
    parts.push("## Open Threads\n\n*No active threads.*");
  }

  parts.push(
    "## Timeline\n\n*No timeline entries yet. Run a dream cycle to auto-extract dates.*"
  );

  return parts.join("\n\n");
}

/**
 * Extract a named section from raw content.
 * Handles both "## Section Name" and "# Section Name" formats.
 */
function extractSection(raw: string, sectionName: string): string | null {
  // Find the section header
  const pattern = new RegExp(
    `#{1,3}\\s*${escapeRegex(sectionName)}\\s*\\n`,
    "i"
  );
  const match = raw.match(pattern);
  if (!match || match.index === undefined) return null;

  const startIndex = match.index;
  const contentStart = startIndex + match[0].length;

  // Find the next section header (## or #) after this one
  const remaining = raw.slice(contentStart);
  const nextHeader = remaining.match(/^#{1,3}\s+\w/m);

  let contentEnd: number;
  if (nextHeader && nextHeader.index !== undefined) {
    contentEnd = contentStart + nextHeader.index;
  } else {
    contentEnd = raw.length;
  }

  const sectionContent = raw.slice(startIndex, contentEnd).trim();
  return sectionContent || null;
}

/**
 * Detect entity names mentioned in the content for cross-referencing.
 */
function extractEntityMentions(content: string, selfName: string): string[] {
  const entities: string[] = [];
  const nameRegex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g;
  const matches = content.match(nameRegex) || [];

  for (const match of matches) {
    const normalized = match.trim();
    if (
      normalized.length > 3 &&
      !normalized.includes(selfName.split(" ")[0]) &&
      !entities.includes(normalized) &&
      !isCommonPhrase(normalized)
    ) {
      entities.push(normalized);
    }
  }

  return entities.slice(0, 20); // Cap at 20
}

function isCommonPhrase(text: string): boolean {
  const common = [
    "Executive Summary", "What They", "What Motivates", "Open Threads",
    "Key People", "Market Position", "Hobby Horses", "No data yet",
    "State Department", "United States", "San Francisco", "New York",
    "Silicon Valley", "Open Source", "Artificial Intelligence",
    "Machine Learning", "Software Engineer",
  ];
  return common.some((c) => text.toLowerCase().includes(c.toLowerCase()));
}

/**
 * Suggest tags based on enriched content.
 */
function suggestTags(content: string, type: EnrichEntityType): string[] {
  const tags: string[] = [];
  const lower = content.toLowerCase();

  const tagPatterns: [string, RegExp][] = [
    ["ai", /artificial intelligence|machine learning|llm|gpt|openai|ai\b/i],
    ["startup", /startup|seed stage|series [a-c]|early.stage/i],
    ["vc", /venture capital|vc\b|investor|fund/i],
    ["enterprise", /enterprise|b2b|saas/i],
    ["founder", /founder|co-founder|founding/i],
    ["engineering", /engineer|engineering|developer|cto|technical/i],
    ["design", /design|designer|ux|creative/i],
    ["product", /product manager|product lead|product strategy/i],
    ["research", /research|researcher|phd|academic|professor/i],
    ["crypto", /crypto|blockchain|web3|defi|ethereum/i],
  ];

  for (const [tag, pattern] of tagPatterns) {
    if (pattern.test(lower)) {
      tags.push(tag);
    }
  }

  tags.push(type); // Always tag with entity type
  return tags;
}

function escapeYaml(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, " ");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
