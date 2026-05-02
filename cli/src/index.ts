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
import { enrichCommand } from "./commands/enrich.js";
import { askCommand } from "./commands/ask.js";
import { rawDataCommand } from "./commands/raw-data.js";
import { tagsCommand } from "./commands/tags.js";
import { versionsCommand } from "./commands/versions.js";
import { jobsCommand } from "./commands/jobs.js";
import { apiKeysCommand } from "./commands/api-keys.js";
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
  .version("0.2.0")
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
    await searchCommand(query, config, { ...program.opts(), limit: options.limit });
  });

program
  .command("query <question>")
  .description("natural language query")
  .option("-l, --limit <n>", "max results", parseInt, 20)
  .action(async (question, options) => {
    const config = getConfig();
    await queryCommand(question, config, { ...program.opts(), limit: options.limit });
  });

program
  .command("ask <question>")
  .description("ask a question and get an LLM-generated answer with cited sources")
  .action(async (question) => {
    const config = getConfig();
    await askCommand(question, config, program.opts());
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
  .option("--written-by <agent>", "filter by author/agent")
  .option("-l, --limit <n>", "max results", parseInt, 50)
  .option("-o, --offset <n>", "skip N results", parseInt, 0)
  .action(async (options) => {
    const config = getConfig();
    await listCommand(config, { ...program.opts(), ...options });
  });

program
  .command("traverse <slug>")
  .description("traverse the knowledge graph from a page")
  .option("-d, --depth <n>", "traversal depth", parseInt, 2)
  .option("--link-type <type>", "filter edges by link type (e.g. works_at, invested_in)")
  .addOption(
    new Option("--direction <dir>", "link direction")
      .choices(["out", "in", "both"])
      .default("out")
  )
  .action(async (slug, options) => {
    const config = getConfig();
    await traverseCommand(slug, config, { ...program.opts(), depth: options.depth, direction: options.direction, linkType: options.linkType });
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
  .option("--written-by <agent>", "agent or user identifier (e.g. 'lara', 'jarvis')")
  .action(async (slug, title, options) => {
    const config = getConfig();
    let content = options.content;
    if (options.stdin) {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      content = Buffer.concat(chunks).toString("utf-8");
    }
    await putPageCommand(slug, title, config, { ...program.opts(), type: options.type, content, writtenBy: options.writtenBy });
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
  .option("--written-by <agent>", "agent or user identifier")
  .action(async (from, to, options) => {
    const config = getConfig();
    await addLinkCommand(from, to, config, { ...program.opts(), type: options.type, writtenBy: options.writtenBy });
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
  .option("--written-by <agent>", "agent or user identifier")
  .action(async (slug, date, summary, options) => {
    const config = getConfig();
    await addTimelineCommand(slug, date, summary, config, { ...program.opts(), detail: options.detail, source: options.source, writtenBy: options.writtenBy });
  });

// ── Enrichment ──────────────────────────────────────────────────

program
  .command("enrich <name>")
  .description("enrich a person or company page (Brave web search + OpenAI formatting)")
  .option("-t, --tier <n>", "enrichment tier: 1=full (async), 2=standard (default, <10s), 3=quick (<5s)", "2")
  .option("--type <type>", "entity type: person, company, or auto (default)")
  .option("--context <text>", "additional context about the entity")
  .option("--force", "re-enrich even if updated within 7 days")
  .action(async (name, options) => {
    const config = getConfig();
    await enrichCommand(name, config, { ...program.opts(), tier: options.tier, type: options.type, context: options.context, force: options.force });
  });

// ── Tags ────────────────────────────────────────────────────────

program
  .command("tags <slug>")
  .description("view tags on a page")
  .option("--add <tag>", "add a tag to the page")
  .option("--remove <tag>", "remove a tag from the page")
  .action(async (slug, options) => {
    const config = getConfig();
    await tagsCommand(slug, config, { ...program.opts(), add: options.add, remove: options.remove });
  });

// ── Raw data ────────────────────────────────────────────────────

program
  .command("raw-data <slug>")
  .description("view stored provenance data for a page")
  .option("--source <source>", "filter by source (e.g. brave, openai)")
  .action(async (slug, options) => {
    const config = getConfig();
    await rawDataCommand(slug, config, { ...program.opts(), source: options.source });
  });

// ── Versions ────────────────────────────────────────────────────

program
  .command("versions <slug>")
  .description("view page version history")
  .action(async (slug) => {
    const config = getConfig();
    await versionsCommand(slug, config, program.opts());
  });

// ── Jobs ────────────────────────────────────────────────────────

program
  .command("jobs [jobId]")
  .description("list jobs or view a specific job by ID")
  .option("--status <status>", "filter by status (waiting, active, completed, failed)")
  .option("-l, --limit <n>", "max results", parseInt, 20)
  .action(async (jobId, options) => {
    const config = getConfig();
    await jobsCommand(jobId, config, { ...program.opts(), status: options.status, limit: options.limit });
  });

// ── API keys ────────────────────────────────────────────────────

program
  .command("api-keys")
  .description("list API keys")
  .option("--create <name>", "create a new API key with this name")
  .option("--revoke <id>", "revoke an API key by ID")
  .action(async (options) => {
    const config = getConfig();
    await apiKeysCommand(config, { ...program.opts(), name: options.create, revoke: options.revoke });
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
