/**
 * Typed link inference for Brainbase — deterministic, zero-LLM.
 *
 * Based on GBrain's link-extraction.ts, calibrated for rich prose.
 * Two-layer inference:
 *   1. Per-edge: 240-char window around slug mention → explicit verbs
 *   2. Page-role prior: when per-edge falls through, check if source page
 *      describes the author as partner/investor/advisor/employee.
 *
 * Precedence: founded > invested_in > advises > works_at > role_prior > mentions
 */

// ─── Employment context ─────────────────────────────────────────
const WORKS_AT_RE = /\b(?:CEO of|CTO of|COO of|CFO of|CMO of|CRO of|VP at|VP of|VPs? Engineering|VPs? Product|works at|worked at|working at|employed by|employed at|joined as|joined the team|engineer at|engineer for|director at|director of|head of|heads up .{0,20} at|leads engineering|leads product|leads the .{0,20} (?:team|org) at|manages engineering at|manages product at|running (?:engineering|product|design) at|currently at|previously at|previously worked at|spent .* (?:years|months) at|stint at|stint as|tenure at|tenure as|role at|position at|(?:senior|staff|principal|lead|backend|frontend|full-?stack|ML|data|security) engineer at|promoted to (?:senior|staff|principal|lead) .{0,20} at|(?:his|her|their|my) time at)\b/i;

// ─── Investment context ─────────────────────────────────────────
const INVESTED_RE = /\b(?:invested in|invests in|investing in|invest in|investment in|investments in|backed by|funding from|funded by|raised from|led the (?:seed|Series|round|investment|round)|led .{0,30}(?:Series [A-Z]|seed|round|investment)|participated in (?:the )?(?:seed|Series|round)|wrote (?:a |the )?check|first check|early investor|portfolio (?:company|includes)|board seat (?:at|in|on)|term sheet for)\b/i;

// ─── Founded context ────────────────────────────────────────────
const FOUNDED_RE = /\b(?:founded|co-?founded|started the company|incorporated|founder of|founders? (?:include|are)|the founder|is a co-?founder|is one of the founders)\b/i;

// ─── Advise context ─────────────────────────────────────────────
const ADVISES_RE = /\b(?:advises|advised|advisor (?:to|at|for|of)|advisory (?:board|role|position|capacity|engagement|partnership|contract|relationship|work)|board advisor|on .{0,20} advisory board|joined .{0,20} advisory board|in an? advisory (?:capacity|role|position)|as an? (?:advisor|security advisor|technical advisor|strategic advisor|industry advisor|product advisor|board advisor|senior advisor)|(?:strategic|technical|security|product|industry|senior|board) advisor (?:to|at|for|of)|consults for|consulting role (?:at|with))\b/i;

// ─── Page-role priors ───────────────────────────────────────────
const PARTNER_ROLE_RE = /\b(?:partner at|partner of|venture partner|VC partner|invested early|investor at|investor in|portfolio|venture capital|early-stage investor|seed investor|fund [A-Z]|invests across|backs companies)\b/i;
const ADVISOR_ROLE_RE = /\b(?:full-time advisor|professional advisor|advises (?:multiple|several|various)|is an? (?:advisor|security advisor|technical advisor|strategic advisor|industry advisor|product advisor|senior advisor)|took on advisory roles|(?:her|his|their) advisory (?:work|role|engagement|portfolio)|serves as (?:an )?advisor)\b/i;
const EMPLOYEE_ROLE_RE = /\b(?:is an? (?:senior|staff|principal|lead|backend|frontend|full-?stack|ML|data|security|DevOps|platform)? ?engineer at|is an? (?:senior|staff|principal|lead)? ?(?:developer|designer|product manager|engineering manager|director|VP) (?:at|of)|holds? the (?:CTO|CEO|CFO|COO|CMO|CRO|VP) (?:role|position|seat|title) at|is the (?:CTO|CEO|CFO|COO|CMO|CRO) of|employee at|on the team at|works on .{0,30} at)\b/i;

// ─── Relationship context (family, friend) ──────────────────────
const FAMILY_RE = /\b(?:mother|father|mom|dad|parent|brother|sister|sibling|cousin|grandmother|grandfather|grandma|grandpa|aunt|uncle|niece|nephew|in-?law|wife|husband|spouse|married to|divorced from)\b/i;
const FRIEND_RE = /\b(?:friend|friends with|college friend|high school friend|childhood friend|close friend|best friend|met through|knows from|grew up with)\b/i;

/** Excerpt a window of `width` chars around `idx`, collapsed to one line. */
function excerpt(s: string, idx: number, width: number): string {
  const half = Math.floor(width / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(s.length, idx + half);
  return s.slice(start, end).replace(/\s+/g, " ").trim();
}

/**
 * Infer link_type from page context. Deterministic regex heuristics, no LLM.
 *
 * @param pageType — type of the source page (person, company, meeting, etc.)
 * @param context — 240-char window around the slug mention
 * @param globalContext — full page content (for page-role prior)
 * @param targetSlug — slug of the target page
 */
export function inferLinkType(
  pageType: string,
  context: string,
  globalContext?: string,
  targetSlug?: string
): string {
  // Media pages only mention
  if (pageType === "media") return "mentions";
  if (pageType === "meeting") return "attended";

  // Per-edge verb rules
  if (FOUNDED_RE.test(context)) return "founded";
  if (INVESTED_RE.test(context)) return "invested_in";
  if (ADVISES_RE.test(context)) return "advises";
  if (WORKS_AT_RE.test(context)) return "works_at";
  if (FAMILY_RE.test(context)) return "family";
  if (FRIEND_RE.test(context)) return "friend";

  // Page-role prior: only for person -> company links
  if (pageType === "person" && globalContext && targetSlug?.startsWith("companies/")) {
    if (PARTNER_ROLE_RE.test(globalContext)) return "invested_in";
    if (ADVISOR_ROLE_RE.test(globalContext)) return "advises";
    if (EMPLOYEE_ROLE_RE.test(globalContext)) return "works_at";
  }

  return "mentions";
}

/**
 * Extract entity references from markdown content.
 * Matches [[slug]] or [[slug|Display]] wikilinks and [Name](path) markdown links.
 */
export interface EntityRef {
  name: string;
  slug: string;
  dir: string;
}

const DIR_PATTERN = "(?:people|companies|concepts|projects|tech|finance|personal|entities|deals|meetings|sources|media)";
const WIKILINK_RE = new RegExp(
  `\\[\\[(${DIR_PATTERN}\\/[^|\\]#]+?)(?:#[^|\\]]*?)?(?:\\|([^\\]]+?))?\\]\\]`,
  "g"
);
const ENTITY_REF_RE = new RegExp(
  `\\[([^\\]]+)\\]\\((?:\\.\\.\\/)*(${DIR_PATTERN}\\/[^)\\s]+?)(?:\\.md)?\\)`,
  "g"
);

function stripCodeBlocks(content: string): string {
  let out = "";
  let i = 0;
  while (i < content.length) {
    if (content.startsWith("```", i)) {
      const end = content.indexOf("```", i + 3);
      if (end === -1) { out += " ".repeat(content.length - i); break; }
      out += " ".repeat(end + 3 - i);
      i = end + 3;
      continue;
    }
    if (content[i] === "`") {
      const end = content.indexOf("`", i + 1);
      if (end === -1 || content.slice(i + 1, end).includes("\n")) {
        out += content[i];
        i++;
        continue;
      }
      out += " ".repeat(end + 1 - i);
      i = end + 1;
      continue;
    }
    out += content[i];
    i++;
  }
  return out;
}

export function extractEntityRefs(content: string): EntityRef[] {
  const stripped = stripCodeBlocks(content);
  const refs: EntityRef[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  // Wikilinks
  const wikiRe = new RegExp(WIKILINK_RE.source, WIKILINK_RE.flags);
  while ((match = wikiRe.exec(stripped)) !== null) {
    let slug = match[1].trim();
    if (slug.endsWith(".md")) slug = slug.slice(0, -3);
    const name = (match[2] || slug).trim();
    const dir = slug.split("/")[0];
    const key = `${slug}\u0000${name}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ name, slug, dir });
    }
  }

  // Markdown links
  const mdRe = new RegExp(ENTITY_REF_RE.source, ENTITY_REF_RE.flags);
  while ((match = mdRe.exec(stripped)) !== null) {
    const name = match[1];
    let slug = match[2];
    if (slug.endsWith(".md")) slug = slug.slice(0, -3);
    const dir = slug.split("/")[0];
    const key = `${slug}\u0000${name}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ name, slug, dir });
    }
  }

  return refs;
}

/**
 * Extract all link candidates from page content with inferred types.
 */
export interface LinkCandidate {
  targetSlug: string;
  linkType: string;
  context: string;
}

export function extractPageLinks(
  pageSlug: string,
  pageType: string,
  content: string
): LinkCandidate[] {
  const candidates: LinkCandidate[] = [];
  const seen = new Set<string>();

  // 1. Entity refs from wikilinks + markdown links
  for (const ref of extractEntityRefs(content)) {
    const idx = content.indexOf(ref.name);
    const context = idx >= 0 ? excerpt(content, idx, 240) : ref.name;
    const linkType = inferLinkType(pageType, context, content, ref.slug);
    const key = `${ref.slug}\u0000${linkType}`;
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push({ targetSlug: ref.slug, linkType, context });
    }
  }

  // 2. Bare slug references (e.g. "see people/alice for context")
  const stripped = stripCodeBlocks(content);
  const bareRe = new RegExp(`\\b(${DIR_PATTERN}\\/[a-z0-9][a-z0-9/-]*[a-z0-9])\\b`, "g");
  let m: RegExpExecArray | null;
  while ((m = bareRe.exec(stripped)) !== null) {
    const charBefore = m.index > 0 ? stripped[m.index - 1] : "";
    if (charBefore === "/" || charBefore === "(") continue;
    const context = excerpt(stripped, m.index, 240);
    const linkType = inferLinkType(pageType, context, content, m[1]);
    const key = `${m[1]}\u0000${linkType}`;
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push({ targetSlug: m[1], linkType, context });
    }
  }

  return candidates;
}
