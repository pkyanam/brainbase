/**
 * GBrain engine — talks to the real GBrain CLI backed by Supabase.
 * Parses human-readable CLI output into structured JSON.
 */
import { execSync } from "child_process";
import type { BrainPage, BrainStats, SearchResult, PageType } from "./types";

const GBRAIN_BIN = process.env.GBRAIN_BIN || "/Users/preetham/.local/bin/gbrain-with-env";

function gbrain(args: string): string {
  try {
    return execSync(`${GBRAIN_BIN} ${args}`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
    }).trim();
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    console.error("gbrain error:", err.message);
    return "";
  }
}

// ─── Stats ────────────────────────────────────────────────
export function getStats(): BrainStats {
  const raw = gbrain("health");
  const result: BrainStats = {
    page_count: 0,
    pages_by_type: {},
    link_count: 0,
    brain_score: 0,
  };

  for (const line of raw.split("\n")) {
    const scoreMatch = line.match(/Health score:\s*(\d+)/);
    if (scoreMatch) result.brain_score = parseInt(scoreMatch[1]);

    const pageMatch = line.match(/Total pages:\s*(\d+)/i);
    if (pageMatch) result.page_count = parseInt(pageMatch[1]);
  }

  // Get type breakdown from list
  const listRaw = gbrain("list --limit 200");
  const typeCounts: Record<string, number> = {};
  for (const line of listRaw.split("\n")) {
    const parts = line.split("\t");
    if (parts.length >= 2) {
      const type = parts[1]?.toLowerCase();
      if (type) typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
  }
  result.pages_by_type = typeCounts;
  result.page_count = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  // Count links from health output
  const connectedSection = raw.indexOf("Most connected entities:");
  if (connectedSection !== -1) {
    const connLines = raw.slice(connectedSection).split("\n");
    for (const line of connLines) {
      const match = line.match(/: (\d+) links?$/);
      if (match) result.link_count += parseInt(match[1]);
    }
  }

  return result;
}

// ─── Pages ────────────────────────────────────────────────
export function getPage(slug: string): BrainPage | null {
  const raw = gbrain(`get "${slug.replace(/"/g, '\\"')}"`);
  if (!raw) return null;

  const lines = raw.split("\n");
  // Skip frontmatter delimiters and extract title
  let title = slug.split("/").pop() || slug;
  let inFrontmatter = false;
  const contentLines: string[] = [];

  for (const line of lines) {
    if (line.trim() === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) {
      const titleMatch = line.match(/^title:\s*"?(.+?)"?$/);
      if (titleMatch) title = titleMatch[1];
    } else {
      contentLines.push(line);
    }
  }

  const type = slug.split("/")[0] as PageType;
  return {
    slug,
    title,
    type: type || "concept",
    content: contentLines.join("\n").trim(),
    frontmatter: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function getAllPages(): BrainPage[] {
  const raw = gbrain("list --limit 200");
  const pages: BrainPage[] = [];

  for (const line of raw.split("\n")) {
    // Format: slug\ttype\tdate\ttitle
    const parts = line.split("\t");
    if (parts.length < 2) continue;

    const slug = parts[0].trim();
    const type = parts[1]?.trim().toLowerCase() as PageType;
    const title = parts[3]?.trim() || slug.split("/").pop() || slug;

    if (!slug) continue;

    pages.push({
      slug,
      title,
      type: type || "concept",
      content: "",
      frontmatter: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return pages;
}

// ─── Search ────────────────────────────────────────────────
export function search(query: string, limit = 10): SearchResult[] {
  const raw = gbrain(`search "${query.replace(/"/g, '\\"')}"`);
  if (!raw) return [];

  const results: SearchResult[] = [];
  const lines = raw.split("\n");

  for (let i = 0; i < lines.length; i++) {
    // [score] slug -- title
    const match = lines[i].match(/^\[([\d.]+)\]\s+(.+?)\s+--\s+(.+)/);
    if (match) {
      const score = parseFloat(match[1]);
      const slug = match[2];
      const title = match[3].replace(/^#\s*/, "");

      // Next line is excerpt
      const excerpt = i + 1 < lines.length ? lines[i + 1] : "";

      results.push({
        slug,
        type: slug.split("/")[0] as PageType,
        title: title || slug,
        score,
        excerpt,
      });
    }
  }

  return results.slice(0, limit);
}

// ─── Links ────────────────────────────────────────────────

export interface BrainLink {
  from_slug: string;
  to_slug: string;
  link_type: string;
}

export function getLinks(): BrainLink[] {
  // Generate edges from page relationships (no slow CLI calls)
  // Groups pages by type and connects related ones
  const allPages = getAllPages();
  const links: BrainLink[] = [];

  // Group by type
  const byType: Record<string, typeof allPages> = {};
  for (const p of allPages) {
    if (!byType[p.type]) byType[p.type] = [];
    byType[p.type].push(p);
  }

  const people = byType.person || [];
  const projects = byType.project || [];
  const companies = byType.company || [];
  const concepts = byType.concept || [];

  // Link all projects to the first person (user)
  if (people.length > 0) {
    for (const proj of projects) {
      links.push({ from_slug: people[0].slug, to_slug: proj.slug, link_type: "built" });
    }
  }

  // Inter-link companies (competitors/collaborators)
  for (let i = 0; i < companies.length; i++) {
    for (let j = i + 1; j < companies.length; j++) {
      links.push({ from_slug: companies[i].slug, to_slug: companies[j].slug, link_type: "competitor" });
    }
  }

  // Link concepts to related projects
  for (const concept of concepts) {
    const matched = projects.filter(p => 
      concept.slug.includes(p.slug.split("/").pop() || "") ||
      p.slug.includes(concept.slug.split("/").pop() || "")
    );
    for (const m of matched.slice(0, 3)) {
      links.push({ from_slug: concept.slug, to_slug: m.slug, link_type: "relates_to" });
    }
  }

  // Link projects to companies by name matching
  for (const proj of projects) {
    const projName = (proj.title || "").toLowerCase();
    for (const comp of companies) {
      const compName = (comp.title || "").toLowerCase();
      if (projName.includes(compName) || compName.includes(projName)) {
        links.push({ from_slug: proj.slug, to_slug: comp.slug, link_type: "uses" });
      }
    }
  }

  return links;
}
