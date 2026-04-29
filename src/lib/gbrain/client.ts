/**
 * GBrain client — environment-aware wrapper around the GBrain CLI.
 * For production: uses GBRAIN_BIN env var or falls back to local install.
 * For multi-tenant: prefixes all slugs with username for isolation.
 */
import { execSync } from "child_process";

const GBRAIN_BIN = process.env.GBRAIN_BIN || 
  `${process.env.HOME || "/Users/preetham"}/.local/bin/gbrain-with-env`;

interface GbrainResult {
  slug: string;
  status: string;
  chunks?: number;
  auto_links?: { created: number; removed: number; errors: number };
}

/**
 * Execute a gbrain CLI command.
 */
export function gbrainExec(args: string, input?: string): string {
  const cmd = input
    ? `echo '${input.replace(/'/g, "'\\''")}' | ${GBRAIN_BIN} ${args}`
    : `${GBRAIN_BIN} ${args}`;

  return execSync(cmd, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30000,
    env: { ...process.env, HOME: process.env.HOME || "/Users/preetham" },
  }).trim();
}

/**
 * Put a page into the brain. Optionally scoped by username.
 */
export function putPage(
  slug: string,
  title: string,
  type: string,
  content: string,
  username?: string
): GbrainResult {
  const fullSlug = username ? `${username}/${slug}` : slug;
  const fullContent = `---\ntitle: "${title.replace(/"/g, '\\"')}"\ntype: ${type}\n${username ? `user: ${username}\n` : ""}---\n${content}`;
  const result = gbrainExec(`put "${fullSlug}"`, fullContent);
  try {
    return JSON.parse(result);
  } catch {
    return { slug: fullSlug, status: "created" };
  }
}

/**
 * Get stats, optionally filtered by username.
 */
export function getStats(username?: string): {
  page_count: number;
  pages_by_type: Record<string, number>;
  link_count: number;
  brain_score: number;
} {
  // Get all pages
  const listRaw = gbrainExec("list --limit 500");
  const lines = listRaw.split("\n");
  
  const typeCounts: Record<string, number> = {};
  let pageCount = 0;

  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length < 2) continue;
    
    const slug = parts[0];
    // Filter by username if provided
    if (username && !slug.startsWith(`${username}/`)) continue;
    
    const type = parts[1]?.toLowerCase();
    if (type) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      pageCount++;
    }
  }

  // Get health score
  const healthRaw = gbrainExec("health");
  let brainScore = 5;
  const scoreMatch = healthRaw.match(/Health score:\s*(\d+)/);
  if (scoreMatch) brainScore = parseInt(scoreMatch[1]);

  return {
    page_count: pageCount,
    pages_by_type: typeCounts,
    link_count: 0, // gbrain doesn't expose per-user link counts easily
    brain_score: brainScore,
  };
}

/**
 * List all pages for a username. If no username, returns all.
 */
export function getAllPages(username?: string): Array<{
  slug: string;
  type: string;
  title: string;
  updated_at: string;
}> {
  const raw = gbrainExec("list --limit 500");
  const lines = raw.split("\n");
  const pages: Array<{ slug: string; type: string; title: string; updated_at: string }> = [];

  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length < 2) continue;
    
    const slug = parts[0];
    if (username && !slug.startsWith(`${username}/`)) continue;
    
    pages.push({
      slug,
      type: parts[1]?.toLowerCase() || "concept",
      title: parts[3] || slug.split("/").pop() || slug,
      updated_at: parts[2] || new Date().toISOString(),
    });
  }

  return pages;
}

/**
 * Get a single page by slug, optionally scoped by username.
 */
export function getPage(
  slug: string,
  username?: string
): {
  slug: string;
  title: string;
  type: string;
  content: string;
  updated_at: string;
} | null {
  const fullSlug = username ? `${username}/${slug}` : slug;
  
  try {
    const raw = gbrainExec(`get "${fullSlug.replace(/"/g, '\\"')}"`);
    if (!raw) return null;

    const lines = raw.split("\n");
    let title = slug.split("/").pop() || slug;
    let inFrontmatter = false;
    const contentLines: string[] = [];

    for (const line of lines) {
      if (line.trim() === "---") {
        inFrontmatter = !inFrontmatter;
        continue;
      }
      if (inFrontmatter) {
        const titleMatch = line.match(/^title:\s*"?(.+?)"?\s*$/);
        if (titleMatch) title = titleMatch[1];
      } else {
        contentLines.push(line);
      }
    }

    return {
      slug: fullSlug,
      title,
      type: slug.split("/")[0] || "concept",
      content: contentLines.join("\n").trim(),
      updated_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
