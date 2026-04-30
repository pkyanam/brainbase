/**
 * Output formatting utilities for the Brainbase CLI.
 *
 * Handles:
 * - Colored terminal output
 * - JSON mode (--json flag)
 * - Quiet mode (--quiet flag)
 * - Table formatting
 */

import chalk from "chalk";
import { GlobalOptions } from "../types.js";

/** Format a search result or page list item */
export function formatPageLine(
  item: { type: string; title: string; slug: string; score?: number },
  opts: GlobalOptions
): string {
  if (opts.json) return "";

  const typeStr = chalk.magenta(`[${item.type}]`);
  const titleStr = chalk.bold(item.title);
  const metaParts: string[] = [chalk.gray(item.slug)];

  if (item.score !== undefined) {
    metaParts.unshift(`${Math.round(item.score * 100)}%`);
  }

  return `${typeStr} ${titleStr} ${chalk.gray(`(${metaParts.join(", ")})`)}`;
}

/** Format a health/stats block */
export function formatHealth(data: {
  page_count: number;
  chunk_count: number;
  link_count: number;
  embed_coverage: number;
  brain_score: number;
  pages_by_type: Record<string, number>;
  most_connected: { slug: string; link_count: number }[];
}): string {
  const lines: string[] = [
    chalk.bold("Brain Health"),
    `  Pages:      ${data.page_count}`,
    `  Links:      ${data.link_count}`,
    `  Chunks:     ${data.chunk_count}`,
    `  Embeddings: ${data.embed_coverage}%`,
    `  Score:      ${data.brain_score}/100`,
    "",
    chalk.bold("By Type:"),
    ...Object.entries(data.pages_by_type).map(
      ([type, count]) => `  ${type}: ${count}`
    ),
    "",
    chalk.bold("Most Connected:"),
    ...data.most_connected.map(
      (c) => `  ${c.slug} (${c.link_count} links)`
    ),
  ];
  return lines.join("\n");
}

/** Format page detail output */
export function formatPageDetail(page: {
  type: string;
  title: string;
  slug: string;
  content?: string;
  links?: {
    outgoing: { title: string; link_type: string }[];
    incoming: { title: string; link_type: string }[];
  };
}): string {
  const lines: string[] = [
    `${chalk.magenta(`[${page.type}]`)} ${chalk.bold(page.title)}`,
    chalk.gray(page.slug),
  ];

  if (page.links?.outgoing?.length) {
    lines.push("", chalk.bold("Links:"));
    for (const l of page.links.outgoing.slice(0, 10)) {
      lines.push(`  → ${l.title} ${chalk.gray(`(${l.link_type})`)}`);
    }
  }

  if (page.content) {
    const preview = page.content.slice(0, 800);
    lines.push("", preview + (page.content.length > 800 ? "…" : ""));
  }

  return lines.join("\n");
}

/** Format links list */
export function formatLinks(data: {
  outgoing: { title: string; link_type: string }[];
  incoming: { title: string; link_type: string }[];
}): string {
  const lines: string[] = [
    `${chalk.bold(`Outgoing (${data.outgoing.length}):`)}`,
    ...data.outgoing
      .slice(0, 20)
      .map((l) => `  → ${l.title} ${chalk.gray(`(${l.link_type})`)}`),
    "",
    `${chalk.bold(`Incoming (${data.incoming.length}):`)}`,
    ...data.incoming
      .slice(0, 10)
      .map((l) => `  ← ${l.title} ${chalk.gray(`(${l.link_type})`)}`),
  ];
  return lines.join("\n");
}

/** Format timeline entries */
export function formatTimeline(
  entries: { date: string; summary: string; detail?: string; source?: string }[]
): string {
  if (entries.length === 0) return "No timeline entries.";

  const lines: string[] = [
    chalk.bold(`Timeline (${entries.length} entries):`),
  ];

  for (const e of entries) {
    lines.push("", `${chalk.bold(e.date)} — ${e.summary}`);
    if (e.detail) lines.push(`  ${e.detail}`);
    if (e.source) lines.push(chalk.gray(`  Source: ${e.source}`));
  }

  return lines.join("\n");
}

/** Format traversal results */
export function formatTraversal(
  results: { depth: number; type: string; title: string; slug: string }[],
  startSlug: string,
  direction: string,
  depth: number
): string {
  const lines: string[] = [
    chalk.bold(`Traversal from ${startSlug} (${direction}, depth ${depth}):`),
  ];

  for (const r of results) {
    const indent = "  ".repeat(r.depth);
    lines.push(
      `${indent}${chalk.magenta(`[${r.type}]`)} ${r.title} ${chalk.gray(`(${r.slug})`)}`
    );
  }

  return lines.join("\n");
}

/** Output data respecting --json and --quiet flags */
export function output(data: unknown, opts: GlobalOptions): void {
  if (opts.quiet) return;

  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (typeof data === "string") {
    console.log(data);
  }
}

/** Print a success message */
export function success(message: string, opts: GlobalOptions): void {
  if (opts.quiet || opts.json) return;
  console.log(chalk.green(`✓ ${message}`));
}

/** Print a warning */
export function warning(message: string, opts: GlobalOptions): void {
  if (opts.quiet) return;
  console.error(chalk.yellow(`⚠ ${message}`));
}

/** Print a table-like list of key-value pairs */
export function formatPairs(pairs: Record<string, string | number>): string {
  const maxKey = Math.max(...Object.keys(pairs).map((k) => k.length));
  return Object.entries(pairs)
    .map(([k, v]) => `  ${k.padEnd(maxKey)}  ${v}`)
    .join("\n");
}
