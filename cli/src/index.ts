#!/usr/bin/env node
/**
 * Brainbase CLI — query and manage your knowledge graph from the terminal.
 *
 * @packageDocumentation
 */

import { Command, Option } from "commander";
import { loadConfig } from "./utils/config.js";
import { searchCommand } from "./commands/search.js";
import { queryCommand } from "./commands/query.js";
import { healthCommand } from "./commands/health.js";
import { statsCommand } from "./commands/stats.js";
import { pageCommand } from "./commands/page.js";
import { linksCommand } from "./commands/links.js";
import { timelineCommand } from "./commands/timeline.js";
import { listCommand } from "./commands/list.js";
import { traverseCommand } from "./commands/traverse.js";
import { graphCommand } from "./commands/graph.js";
import { putPageCommand } from "./commands/put-page.js";
import { deletePageCommand } from "./commands/delete-page.js";
import { addLinkCommand } from "./commands/add-link.js";
import { removeLinkCommand } from "./commands/remove-link.js";
import { addTimelineCommand } from "./commands/add-timeline.js";
import { configSetCommand, configGetCommand, configListCommand, configUnsetCommand } from "./commands/config.js";

const program = new Command();

function getConfig(): ReturnType<typeof loadConfig> {
  const opts = program.opts();
  return loadConfig({
    apiKey: opts.apiKey,
    brainId: opts.brainId,
  });
}

program
  .name("brainbase")
  .description("CLI for Brainbase — the knowledge graph for AI agents")
  .version("0.1.0")
  .option("--brain-id <id>", "target a specific brain (overrides BRAINBASE_BRAIN_ID)")
  .option("--api-key <key>", "API key (overrides BRAINBASE_API_KEY)")
  .option("--json", "output raw JSON instead of formatted text")
  .option("--quiet", "suppress non-error output")
  .option("--verbose", "enable verbose logging")
  .configureHelp({ sortSubcommands: true });

// ── Read operations ─────────────────────────────────────────────

program
  .command("search <query>")
  .description("full-text search across your brain")
  .option("-l, --limit <n>", "max results", parseInt, 20)
  .action(async (query, options) => {
    const config = getConfig();
    const globalOpts = program.opts();
    await searchCommand(query, config, {
      ...globalOpts,
      limit: options.limit,
    });
  });

program
  .command("query <question>")
  .description("natural language query")
  .option("-l, --limit <n>", "max results", parseInt, 20)
  .action(async (question, options) => {
    const config = getConfig();
    const globalOpts = program.opts();
    await queryCommand(question, config, {
      ...globalOpts,
      limit: options.limit,
    });
  });

program
  .command("health")
  .description("show brain health dashboard")
  .action(async () => {
    const config = getConfig();
    await healthCommand(config, program.opts());
  });

program
  .command("stats")
  .description("show detailed brain statistics")
  .action(async () => {
    const config = getConfig();
    await statsCommand(config, program.opts());
  });

program
  .command("page <slug>")
  .description("get a page by slug")
  .action(async (slug) => {
    const config = getConfig();
    await pageCommand(slug, config, program.opts());
  });

program
  .command("links <slug>")
  .description("show links for a page")
  .action(async (slug) => {
    const config = getConfig();
    await linksCommand(slug, config, program.opts());
  });

program
  .command("timeline <slug>")
  .description("show timeline entries for a page")
  .action(async (slug) => {
    const config = getConfig();
    await timelineCommand(slug, config, program.opts());
  });

program
  .command("list")
  .description("list all pages")
  .option("-t, --type <type>", "filter by page type")
  .option("-l, --limit <n>", "max results", parseInt, 50)
  .option("-o, --offset <n>", "skip N results", parseInt, 0)
  .action(async (options) => {
    const config = getConfig();
    const globalOpts = program.opts();
    await listCommand(config, {
      ...globalOpts,
      type: options.type,
      limit: options.limit,
      offset: options.offset,
    });
  });

program
  .command("traverse <slug>")
  .description("traverse the knowledge graph from a page")
  .option("-d, --depth <n>", "traversal depth", parseInt, 2)
  .addOption(
    new Option("--direction <dir>", "link direction")
      .choices(["out", "in", "both"])
      .default("out")
  )
  .action(async (slug, options) => {
    const config = getConfig();
    const globalOpts = program.opts();
    await traverseCommand(slug, config, {
      ...globalOpts,
      depth: options.depth,
      direction: options.direction,
    });
  });

program
  .command("graph")
  .description("dump the full knowledge graph as JSON")
  .action(async () => {
    const config = getConfig();
    await graphCommand(config, program.opts());
  });

// ── Write operations ────────────────────────────────────────────

program
  .command("put-page <slug> <title>")
  .description("create or update a page")
  .option("-t, --type <type>", "page type (e.g. person, company, idea)")
  .option("-c, --content <content>", "page markdown content")
  .option("--stdin", "read content from stdin instead of --content flag")
  .action(async (slug, title, options) => {
    const config = getConfig();
    const globalOpts = program.opts();

    let content = options.content;
    if (options.stdin) {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      content = Buffer.concat(chunks).toString("utf-8");
    }

    await putPageCommand(slug, title, config, {
      ...globalOpts,
      type: options.type,
      content,
    });
  });

program
  .command("delete-page <slug>")
  .description("delete a page")
  .action(async (slug) => {
    const config = getConfig();
    await deletePageCommand(slug, config, program.opts());
  });

program
  .command("add-link <from> <to>")
  .description("create a link between two pages")
  .option("-t, --type <type>", "link type (e.g. works_at, invested_in)")
  .action(async (from, to, options) => {
    const config = getConfig();
    const globalOpts = program.opts();
    await addLinkCommand(from, to, config, {
      ...globalOpts,
      type: options.type,
    });
  });

program
  .command("remove-link <from> <to>")
  .description("remove a link between two pages")
  .action(async (from, to) => {
    const config = getConfig();
    await removeLinkCommand(from, to, config, program.opts());
  });

program
  .command("add-timeline <slug> <date> <summary>")
  .description("add a timeline entry to a page")
  .option("-d, --detail <detail>", "detailed description")
  .option("-s, --source <source>", "source URL or citation")
  .action(async (slug, date, summary, options) => {
    const config = getConfig();
    const globalOpts = program.opts();
    await addTimelineCommand(slug, date, summary, config, {
      ...globalOpts,
      detail: options.detail,
      source: options.source,
    });
  });

// ── Config commands ────────────────────────────────────────────

const configCmd = program
  .command("config")
  .description("manage persistent CLI settings in ~/.brainbase/config.json");

configCmd
  .command("set <key> <value>")
  .description("set a config value (apiKey, baseUrl, brainId, timeoutMs)")
  .action(async (key, value) => {
    await configSetCommand(key, value, program.opts());
  });

configCmd
  .command("get <key>")
  .description("get a config value")
  .action(async (key) => {
    await configGetCommand(key, program.opts());
  });

configCmd
  .command("list")
  .description("list all config values")
  .action(async () => {
    await configListCommand(program.opts());
  });

configCmd
  .command("unset <key>")
  .description("remove a config value")
  .action(async (key) => {
    await configUnsetCommand(key, program.opts());
  });

// ── Entry point ─────────────────────────────────────────────────

program.parseAsync().catch((err: unknown) => {
  console.error("Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
