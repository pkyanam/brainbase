"use client";

import { useState, useEffect } from "react";

const ONBOARDING_MD = `# Agent Onboarding: Brainbase

> **For:** Any MCP-compatible AI agent
> **Brainbase URL:** \`https://brainbase.belweave.ai\`
> **API Key:** \`BB_API_KEY_PLACEHOLDER\` ← **replace before use**

---

## 1. What You Have Access To

You are an autonomous agent with **persistent memory** via Brainbase — a polyglot knowledge graph combining Supabase Postgres + pgvector (system of record) with Neo4j (graph projection). Every user gets an isolated brain that stores everything your team learns, reads, and decides.

**Your job:** Read from the brain before answering. Write to the brain when you learn something new. Link related concepts so the graph stays connected.

---

## 2. Authentication

All write operations (and MCP calls) require an API key:

\`\`\`
Authorization: Bearer ***
\`\`\`

**Base URL:** \`https://brainbase.belweave.ai/api/mcp\`

**Multi-brain support:** If you need to access a brain other than your default, add:
\`\`\`
X-Brain-Id: <brain-uuid>
\`\`\`

---

## 3. MCP Tools (23 Available)

Connect via JSON-RPC 2.0 to \`POST /api/mcp\`.

### Read Tools (no quota cost)

| Tool | Purpose | Key Params |
|------|---------|------------|
| \`search\` | Full-text search pages | \`query: string\` |
| \`query\` | Natural language search | \`question: string\` |
| \`get_page\` | Get full page content + links + timeline | \`slug: string\` |
| \`get_links\` | Outgoing links from a page | \`slug: string\` |
| \`get_backlinks\` | Pages that link TO this page | \`slug: string\` |
| \`get_timeline\` | Timeline entries for a page | \`slug: string\` |
| \`get_health\` | Brain stats + score | — |
| \`get_stats\` | Detailed stats by type | — |
| \`get_graph\` | Full graph (nodes + edges) | — |
| \`list_pages\` | List pages with filters | \`type?, written_by?, limit?, offset?\` |
| \`traverse_graph\` | Walk the graph from a page | \`slug, depth?, direction?, link_type?\` |
| \`list_triggers\` | List active trigger rules | — |
| \`pagerank\` | Most central pages (Neo4j GDS or fallback) | \`limit?\` |
| \`communities\` | Louvain community detection | \`limit?\` |
| \`shortest_path\` | Shortest path between two pages | \`from, to, max_depth?\` |
| \`similar_pages\` | Pages similar by link structure | \`slug, limit?\` |

### Write Tools (quota-limited)

| Tool | Purpose | Key Params |
|------|---------|------------|
| \`put_page\` | Create/update a page | \`slug, title, type?, content?, frontmatter?, written_by?\` |
| \`delete_page\` | Remove a page | \`slug\` |
| \`add_link\` | Create typed link | \`from, to, link_type?, written_by?\` |
| \`remove_link\` | Remove a link | \`from, to\` |
| \`add_timeline_entry\` | Add event to timeline | \`slug, date, summary, detail?, source?, written_by?\` |
| \`upsert_trigger\` | Create automation rule | \`name, conditions, actions, enabled?, cooldown_minutes?\` |
| \`run_triggers\` | Manually fire rules on page | \`slug, title, type?, content?\` |

### Enrichment (REST API)

Brainbase's enrichment pipeline creates rich, sourced pages for people and companies with
a single API call. Uses Brave Search + OpenAI formatting.

\`POST /api/brain/enrich\` — See [Enrichment API](#enrichment) section below.

---

## 4. How to Think About the Brain

### Page Structure
Every page has:
- **slug** — unique ID (e.g., \`people/garry-tan\`, \`projects/brainbase\`)
- **type** — \`person\`, \`company\`, \`project\`, \`concept\`, \`email\`, \`idea\`, etc.
- **content** — markdown body
- **links** — typed connections to other pages (\`related\`, \`works_at\`, \`invested_in\`, \`founded\`, etc.)
- **timeline** — dated events
- **embeddings** — OpenAI text-embedding-3-small vector for semantic search

### Your Read Pattern (ALWAYS DO THIS FIRST)

\`\`\`
1. User asks a question
2. SEARCH the brain first → get relevant slugs
3. GET_PAGE on the most relevant result → read full context
4. GET_LINKS / TRAVERSE_GRAPH → explore connections
5. Answer the user WITH citations to brain pages
\`\`\`

### Your Write Pattern

\`\`\`
1. You learn something new (from email, web, conversation)
2. PUT_PAGE with proper frontmatter:

   ---
   type: email | person | company | concept | project
   date: YYYY-MM-DD
   source: agentmail | web | conversation
   tags: [newsletter, security, ai]
   ---

3. If related pages exist → ADD_LINK to connect them
4. If dates mentioned → ADD_TIMELINE_ENTRY
\`\`\`

---

## 5. Example Workflows

### Example 1: Answer a question about someone
\`\`\`json
// 1. Search
{"method": "tools/call", "params": {"name": "search", "arguments": {"query": "Garry Tan"}}}

// 2. Get page
{"method": "tools/call", "params": {"name": "get_page", "arguments": {"slug": "people/garry-tan"}}}

// 3. Get connections
{"method": "tools/call", "params": {"name": "get_links", "arguments": {"slug": "people/garry-tan"}}}

// 4. Find most connected people
{"method": "tools/call", "params": {"name": "pagerank", "arguments": {"limit": 10}}}
\`\`\`

### Example 2: Ingest a security alert
\`\`\`json
// 1. Write the page
{"method": "tools/call", "params": {"name": "put_page", "arguments": {
  "slug": "security/cve-2025-1234",
  "title": "CVE-2025-1234: Critical RCE in OpenSSL",
  "type": "concept",
  "content": "# CVE-2025-1234...",
  "frontmatter": {"date": "2025-04-29", "severity": "critical", "source": "nist"}
}}}

// 2. Link to affected project
{"method": "tools/call", "params": {"name": "add_link", "arguments": {
  "from": "security/cve-2025-1234",
  "to": "projects/brainbase",
  "link_type": "affects"
}}}
\`\`\`

### Example 3: Set up a trigger
\`\`\`json
{"method": "tools/call", "params": {"name": "upsert_trigger", "arguments": {
  "name": "cve-alert",
  "conditions": {"pageType": "concept", "contentContains": ["CVE", "vulnerability"]},
  "actions": [{"type": "notify", "message": "🚨 CVE detected: {slug}"}],
  "enabled": true
}}}
\`\`\`

### Example 4: Graph intelligence
\`\`\`json
// Find shortest path between two entities
{"method": "tools/call", "params": {"name": "shortest_path", "arguments": {
  "from": "people/garry-tan",
  "to": "companies/anthropic",
  "max_depth": 4
}}}

// Find similar pages by link structure
{"method": "tools/call", "params": {"name": "similar_pages", "arguments": {
  "slug": "people/garry-tan",
  "limit": 10
}}}
\`\`\`

---

## 6. Important Rules

### DO
- **Search the brain first** before using external APIs or claiming ignorance
- Use descriptive slugs: \`people/first-last\`, \`companies/company-name\`, \`projects/project-name\`
- Include frontmatter with \`type\`, \`date\`, and \`source\`
- Link related pages — isolated pages are useless
- Write in markdown with headers for structure
- Use timeline entries for dated events
- Use \`written_by\` parameter to track which agent created content

### DON'T
- Don't write pages without checking if they already exist (search first)
- Don't create generic slugs like \`page-1\` or \`untitled\`
- Don't dump raw data — summarize and structure it
- Don't forget to link — the graph is the value
- Don't expose the API key in logs or user-facing output

---

## 7. Page Types & Conventions

| Type | Use For | Example Slug |
|------|---------|--------------|
| \`person\` | People your team knows | \`people/jane-doe\` |
| \`company\` | Companies, orgs | \`companies/openai\` |
| \`project\` | Code projects, initiatives | \`projects/brainbase\` |
| \`concept\` | Ideas, frameworks, CVEs | \`concepts/rag-pipeline\` |
| \`email\` | Ingested emails | \`email/team/2026-04-29/subject\` |
| \`idea\` | Raw thoughts, brainstorming | \`ideas/agent-email-integration\` |
| \`place\` | Locations, venues | \`places/san-francisco\` |

---

## 8. Troubleshooting

| Issue | Fix |
|-------|-----|
| \`401 Unauthorized\` | API key missing or invalid |
| \`403 Forbidden\` | You don't have access to that brain |
| \`404 Page not found\` | Slug doesn't exist — create it or check spelling |
| Quota exceeded | Write operations are rate-limited; wait or contact your admin |
| Graph empty | Brain has < 2 pages or no links — start adding content |
| \`neo4j_not_configured\` | Graph intelligence requires Neo4j; falls back to Postgres for some ops |

---

## 9. Architecture Notes

- **Database:** Polyglot — Supabase Postgres + pgvector (system of record) + Neo4j (graph projection)
- **Search:** Hybrid full-text + semantic (embeddings), RRF fusion, 7-stage pipeline
- **Graph:** Typed wikilinks stored as edge rows, projected to Neo4j for intelligence
- **Pipeline:** \`put_page\` → embeddings → auto-extract (wikilinks + dates + semantic links) → triggers → actions
- **Graph Backend:** Set \`BRAINBASE_GRAPH_BACKEND=auto|postgres|neo4j\` to control routing
- **Hosting:** Vercel, edge-cached reads

---

**Last updated:** 2026-05-03`;

const MCP_SETUP = (baseUrl: string) => `# MCP Setup — Copy/Paste

## Option A: HTTP Endpoint (Recommended for Agents)

Connect via JSON-RPC 2.0 over HTTP. All tools are available immediately.

### Headers
\`\`\`
Authorization: Bearer <YOUR_API_KEY>
Content-Type: application/json
\`\`\`

### Initialize
\`\`\`bash
curl -X POST ${baseUrl}/api/mcp \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "id": 1
  }'
\`\`\`

### List Tools
\`\`\`bash
curl -X POST ${baseUrl}/api/mcp \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 2
  }'
\`\`\`

### Search
\`\`\`bash
curl -X POST ${baseUrl}/api/mcp \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search",
      "arguments": {"query": "Garry Tan"}
    },
    "id": 3
  }'
\`\`\`

### Get Page
\`\`\`bash
curl -X POST ${baseUrl}/api/mcp \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_page",
      "arguments": {"slug": "people/garry-tan"}
    },
    "id": 4
  }'
\`\`\`

### Write a Page
\`\`\`bash
curl -X POST ${baseUrl}/api/mcp \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "put_page",
      "arguments": {
        "slug": "ideas/new-thing",
        "title": "My New Idea",
        "type": "idea",
        "content": "This is a markdown note."
      }
    },
    "id": 5
  }'
\`\`\`

## Option B: CLI (For Humans & Scripts)

Install the CLI, configure once, use everywhere.

\`\`\`bash
# 1. Install
npm install -g brainbase-cli

# 2. Configure once
brainbase config set apiKey <YOUR_API_KEY>
brainbase config set baseUrl ${baseUrl}
brainbase config set brainId <YOUR_BRAIN_ID>  # optional

# 3. Use
brainbase search "Garry Tan"
brainbase health
brainbase page people/garry-tan
brainbase links people/garry-tan
brainbase graph
brainbase put-page ideas/new-thing "My Idea" --type idea --content "# Hello"
brainbase add-link people/garry-tan companies/y-combinator --type works_at

# Priority: CLI flags > env vars > config file. So you can always override per-command:
brainbase health --api-key bb_live_other --brain-id other-brain
\`\`\`

## Option C: SDK (For Node.js/Bun Apps)

\`\`\`bash
npm install brainbase-sdk
\`\`\`

\`\`\`ts
import { Brainbase } from "brainbase-sdk";

const brain = new Brainbase({
  apiKey: "bb_live_...",
  baseUrl: "${baseUrl}",
});

// Read
const results = await brain.search("Garry Tan");
const page = await brain.getPage("people/garry-tan");
const health = await brain.health();

// Write
await brain.putPage({
  slug: "ideas/new-thing",
  title: "My New Idea",
  type: "idea",
  content: "# Markdown content",
});

// Link
await brain.addLink("people/garry-tan", "companies/y-combinator", "works_at");
\`\`\`
`;

const MCP_CONFIG = (baseUrl: string) => `{
  "mcpServers": {
    "brainbase": {
      "type": "http",
      "url": "${baseUrl}/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_API_KEY>"
      }
    }
  }
}`;

function useBaseUrl() {
  const [baseUrl, setBaseUrl] = useState("https://brainbase.belweave.ai");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);
  return baseUrl;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bb-accent/10 hover:bg-bb-accent/20 text-bb-accent text-xs font-medium rounded-lg border border-bb-accent/20 transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

export default function Docs() {
  const baseUrl = useBaseUrl();

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Documentation</h1>
      <p className="text-bb-text-muted mb-12">Give your AI agents persistent memory in one API call.</p>

      {/* Agent Onboarding Banner */}
      <section id="agent-onboarding" className="mb-12 scroll-mt-24">
        <div className="bg-bb-accent/5 border border-bb-accent/20 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h2 className="text-lg font-semibold text-bb-accent mb-1">→ Onboard Your Agent</h2>
              <p className="text-sm text-bb-text-secondary">
                Copy-paste ready instructions for any MCP-compatible agent (Hermes, Claude Code, Cursor, OpenCode). Replace the API key placeholder before sharing.
              </p>
            </div>
            <CopyButton text={ONBOARDING_MD} label="Copy" />
          </div>
          <div className="bg-bb-bg-secondary border border-bb-border rounded-lg p-4 max-h-64 overflow-y-auto">
            <pre className="text-xs text-bb-text-muted whitespace-pre-wrap leading-relaxed">
              {ONBOARDING_MD}
            </pre>
          </div>
        </div>
      </section>

      <section id="quickstart" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">Quickstart</h2>
        <p className="text-sm text-bb-text-secondary mb-4">Choose your interface — CLI, SDK, or direct MCP. All use the same API under the hood.</p>
        <div className="bg-bb-bg-secondary border border-bb-border rounded-xl p-5 space-y-2">
          <pre className="text-sm text-bb-text-secondary overflow-x-auto">
            <code>{`# CLI (recommended for humans)
npm install -g brainbase-cli
brainbase config set apiKey bb_live_...
brainbase search "Garry Tan"

# SDK (recommended for Node.js apps)
npm install brainbase-sdk`}</code>
          </pre>
        </div>
      </section>

      {/* MCP Setup — Copy/Paste */}
      <section id="mcp-setup" className="mb-12 scroll-mt-24">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Connect via MCP</h2>
            <p className="text-sm text-bb-text-secondary">
              Copy-paste ready configs for any MCP-compatible agent. Pick your poison.
            </p>
          </div>
          <CopyButton text={MCP_CONFIG(baseUrl)} label="Copy Config" />
        </div>

        <div className="space-y-6">
          {/* Option A: HTTP */}
          <div className="border border-bb-border rounded-xl overflow-hidden">
            <div className="bg-bb-bg-secondary px-4 py-3 border-b border-bb-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-bb-text-primary">Option A: HTTP Endpoint</h3>
                <p className="text-xs text-bb-text-muted mt-0.5">Best for agents, scripts, curl. JSON-RPC 2.0.</p>
              </div>
              <CopyButton text={`curl -X POST ${baseUrl}/api/mcp \\\n  -H "Authorization: Bearer <YOUR_API_KEY>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`} label="Copy" />
            </div>
            <div className="p-4 bg-bb-bg-primary">
              <pre className="text-xs text-bb-text-secondary overflow-x-auto">
                <code>{`// 1. Initialize
POST ${baseUrl}/api/mcp
{ "jsonrpc": "2.0", "method": "initialize", "id": 1 }

// 2. Search
POST ${baseUrl}/api/mcp
{ "jsonrpc": "2.0", "method": "tools/call",
  "params": { "name": "search", "arguments": { "query": "Garry Tan" }},
  "id": 2 }

// 3. Get page
POST ${baseUrl}/api/mcp
{ "jsonrpc": "2.0", "method": "tools/call",
  "params": { "name": "get_page", "arguments": { "slug": "people/garry-tan" }},
  "id": 3 }

// 4. Write
POST ${baseUrl}/api/mcp
{ "jsonrpc": "2.0", "method": "tools/call",
  "params": { "name": "put_page",
    "arguments": {
      "slug": "ideas/new-thing",
      "title": "My New Idea",
      "type": "idea",
      "content": "# Hello world"
    }},
  "id": 4 }`}</code>
              </pre>
            </div>
          </div>

          {/* Option B: CLI */}
          <div className="border border-bb-border rounded-xl overflow-hidden">
            <div className="bg-bb-bg-secondary px-4 py-3 border-b border-bb-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-bb-text-primary">Option B: CLI</h3>
                <p className="text-xs text-bb-text-muted mt-0.5">Shell composability, pipes, jq. Lowest cognitive overhead.</p>
              </div>
              <CopyButton text={`npm install -g brainbase-cli
brainbase config set apiKey <YOUR_API_KEY>
brainbase search "Garry Tan"
brainbase health
brainbase pagerank --limit 10`} label="Copy" />
            </div>
            <div className="p-4 bg-bb-bg-primary">
              <pre className="text-xs text-bb-text-secondary overflow-x-auto">
                <code>{`# Install & configure once
npm install -g brainbase-cli
brainbase config set apiKey <YOUR_API_KEY>
brainbase config set baseUrl ${baseUrl}
brainbase config set brainId <BRAIN_ID>  # optional

# Read
brainbase search "Garry Tan"
brainbase query "who invested in Anthropic"
brainbase health
brainbase stats
brainbase page people/garry-tan
brainbase links people/garry-tan
brainbase timeline people/garry-tan
brainbase list --type person --limit 10
brainbase traverse people/garry-tan --depth 2 --direction both

# Graph Intelligence (Neo4j)
brainbase pagerank --limit 25
brainbase communities --limit 500
brainbase shortest-path people/garry-tan companies/y-combinator
brainbase similar people/garry-tan --limit 10
brainbase graph-sync

# Enrichment
brainbase enrich "Satya Nadella" --type person --tier 2
brainbase enrich "Stripe" --tier 2  # auto-detects company

# Write
brainbase put-page ideas/new-thing "My Idea" --type idea --content "# Hello"
brainbase delete-page ideas/obsolete
brainbase add-link people/garry-tan companies/y-combinator --type works_at
brainbase remove-link people/garry-tan companies/old-company
brainbase add-timeline people/garry-tan "2024-03-01" "Became YC CEO"

# Jobs & API keys
brainbase jobs
brainbase jobs 42
brainbase api-keys
brainbase api-keys --create "my-new-key"

# Override per-command (flags > env > config)
brainbase health --api-key bb_live_other --brain-id other-brain`}</code>
              </pre>
            </div>
          </div>

          {/* Option C: SDK */}
          <div className="border border-bb-border rounded-xl overflow-hidden">
            <div className="bg-bb-bg-secondary px-4 py-3 border-b border-bb-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-bb-text-primary">Option C: SDK</h3>
                <p className="text-xs text-bb-text-muted mt-0.5">For Node.js / Bun apps. Full TypeScript support.</p>
              </div>
              <CopyButton text={`npm install brainbase-sdk`} label="Copy" />
            </div>
            <div className="p-4 bg-bb-bg-primary">
              <pre className="text-xs text-bb-text-secondary overflow-x-auto">
                <code>{`import { Brainbase } from "brainbase-sdk";

const brain = new Brainbase({
  apiKey: "bb_live_...",
  baseUrl: "${baseUrl}",
  brainId: "<uuid>",  // optional multi-brain
});

// Read
const results   = await brain.search("Garry Tan");
const page      = await brain.getPage("people/garry-tan");
const health    = await brain.health();
const stats     = await brain.stats();
const graph     = await brain.graph();
const links     = await brain.links("people/garry-tan");
const timeline  = await brain.timeline("people/garry-tan");
const pages     = await brain.listPages({ type: "person", limit: 10 });
const traversal = await brain.traverse("people/garry-tan", { depth: 2 });

// Ask (LLM-generated answer with sources)
const answer = await brain.ask("Who invested in Anthropic?");
// { answer: "...", sources: [...], confidence: 0.87 }

// Enrichment (3-tier system)
const result = await brain.enrich({
  name: "Satya Nadella",
  type: "person",
  tier: 2,  // 1=deep(async), 2=standard(sync), 3=quick(sync)
  context: "Microsoft CEO",
});

// Graph Intelligence (Neo4j)
const pageRank  = await brain.pageRank(25);
const clusters  = await brain.communities(500);
const path      = await brain.shortestPath("people/a", "companies/b");
const similar   = await brain.similarPages("people/garry-tan", 10);
await brain.graphSync();

// Write
await brain.putPage({
  slug: "ideas/new-thing",
  title: "My New Idea",
  type: "idea",
  content: "# Markdown",
  written_by: "agent-name",
});
await brain.addLink("people/garry-tan", "companies/y-combinator", "works_at");
await brain.addTimelineEntry("people/garry-tan", "2024-03-01", "Became YC CEO");
await brain.addTag("people/garry-tan", "founder");

// Jobs
const job = await brain.getJob(42);
const jobs = await brain.listJobs({ status: "active" });

// API Keys
const keys = await brain.listApiKeys();
const created = await brain.createApiKey("my-new-key");`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section id="api" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">API Reference</h2>
        <p className="text-sm text-bb-text-secondary mb-4">Read endpoints return data. Write endpoints require API key auth and count against quota.</p>

        <h3 className="text-sm font-semibold text-bb-text-primary mb-3">Read</h3>
        <div className="space-y-3 mb-8">
          {[
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/health", desc: "Brain statistics and health score." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/stats", desc: "Detailed brain statistics (pages by type, embed coverage, most connected)." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/search?q=...", desc: "Full-text + ILIKE search across all pages." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/list?type=&written_by=&limit=&offset=", desc: "List all pages with metadata. Filter by type or author." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/page/<slug>", desc: "Single page with content, links, and timeline." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/timeline/<slug>", desc: "Timeline entries for a page." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/tags?slug=...", desc: "Tags on a page." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/versions/<slug>", desc: "Page version history." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/activity?limit=&action=", desc: "Brain activity feed." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/raw-data?slug=&source=", desc: "Stored provenance data for a page." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/graph", desc: "Full knowledge graph (nodes + edges)." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/traverse?slug=&depth=&direction=&link_type=", desc: "Graph traversal from a page (out/in/both, max depth 5)." },
            { method: "POST", color: "bg-bb-accent/10 text-bb-accent", path: "/api/ask", desc: "LLM-generated answer with cited sources. POST body: {question}" },
          ].map((ep) => (
            <div key={ep.path} className="border border-bb-border rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-0.5 text-xs font-mono rounded ${ep.color}`}>{ep.method}</span>
                <code className="text-sm text-bb-text-primary">{ep.path}</code>
              </div>
              <p className="text-sm text-bb-text-muted">{ep.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-bb-text-primary mb-3">Write (Auth Required)</h3>
        <div className="space-y-3 mb-8">
          {[
            { method: "PUT", color: "bg-bb-accent-dim/20 text-bb-accent-dim", path: "/api/brain/page/<slug>", desc: "Create or update a page. Body: {title, type?, content?, frontmatter?, written_by?}" },
            { method: "DELETE", color: "bg-red-900/20 text-red-400", path: "/api/brain/page/<slug>", desc: "Delete a page and its associated data." },
            { method: "POST", color: "bg-bb-accent-dim/20 text-bb-accent-dim", path: "/api/brain/link", desc: "Create a link. Body: {from, to, link_type?, written_by?}" },
            { method: "DELETE", color: "bg-red-900/20 text-red-400", path: "/api/brain/link", desc: "Remove a link. Body: {from, to}" },
            { method: "POST", color: "bg-bb-accent-dim/20 text-bb-accent-dim", path: "/api/brain/timeline", desc: "Add timeline entry. Body: {slug, date, summary, detail?, source?, written_by?}" },
            { method: "PUT", color: "bg-bb-accent-dim/20 text-bb-accent-dim", path: "/api/brain/tags", desc: "Add or remove tags. Body: {slug, tag, action: 'add'|'remove'}" },
            { method: "POST", color: "bg-bb-accent/20 text-bb-accent font-semibold", path: "/api/brain/enrich", desc: "✨ Enrich a person/company page. 3-tier pipeline with Brave search + OpenAI. Body: {name, type?, tier?, context?, force?}" },
            { method: "POST", color: "bg-bb-accent/20 text-bb-accent font-semibold", path: "/api/brain/graph-sync", desc: "Trigger Postgres → Neo4j sync. Ensures graph projection is current." },
          ].map((ep) => (
            <div key={ep.path} className="border border-bb-border rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-0.5 text-xs font-mono rounded ${ep.color}`}>{ep.method}</span>
                <code className="text-sm text-bb-text-primary">{ep.path}</code>
              </div>
              <p className="text-sm text-bb-text-muted">{ep.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-bb-text-primary mb-3">Graph Intelligence (Neo4j + Postgres fallback)</h3>
        <div className="space-y-3 mb-8">
          {[
            { method: "GET", color: "bg-purple-900/20 text-purple-400", path: "/api/brain/intel/pagerank?limit=", desc: "PageRank centrality scores. GDS or degree fallback." },
            { method: "GET", color: "bg-purple-900/20 text-purple-400", path: "/api/brain/intel/communities?limit=", desc: "Louvain community detection. Requires Neo4j GDS." },
            { method: "GET", color: "bg-purple-900/20 text-purple-400", path: "/api/brain/intel/shortest-path?from=&to=&maxDepth=", desc: "Shortest path between two pages. Pure Cypher, always available." },
            { method: "GET", color: "bg-purple-900/20 text-purple-400", path: "/api/brain/intel/similar?slug=&limit=", desc: "Node similarity by link structure. GDS or Jaccard fallback." },
          ].map((ep) => (
            <div key={ep.path} className="border border-bb-border rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-0.5 text-xs font-mono rounded ${ep.color}`}>{ep.method}</span>
                <code className="text-sm text-bb-text-primary">{ep.path}</code>
              </div>
              <p className="text-sm text-bb-text-muted">{ep.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-bb-text-primary mb-3">Jobs & API Keys</h3>
        <div className="space-y-3 mb-8">
          {[
            { method: "GET", color: "bg-gray-800/20 text-gray-400", path: "/api/jobs", desc: "List all jobs. Optional: ?status=&limit=" },
            { method: "GET", color: "bg-gray-800/20 text-gray-400", path: "/api/jobs/<id>", desc: "Get job status by ID." },
            { method: "POST", color: "bg-gray-800/20 text-gray-400", path: "/api/jobs/<id>/retry", desc: "Retry a failed job." },
            { method: "GET", color: "bg-gray-800/20 text-gray-400", path: "/api/keys", desc: "List all API keys (masked)." },
            { method: "POST", color: "bg-gray-800/20 text-gray-400", path: "/api/keys", desc: "Create new API key. Body: {name}" },
            { method: "DELETE", color: "bg-gray-800/20 text-gray-400", path: "/api/keys?id=", desc: "Revoke an API key." },
          ].map((ep) => (
            <div key={ep.path} className="border border-bb-border rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-0.5 text-xs font-mono rounded ${ep.color}`}>{ep.method}</span>
                <code className="text-sm text-bb-text-primary">{ep.path}</code>
              </div>
              <p className="text-sm text-bb-text-muted">{ep.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-bb-text-primary mb-3">MCP (JSON-RPC 2.0)</h3>
        <div className="border border-bb-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-0.5 bg-bb-accent-glow text-bb-accent text-xs font-mono rounded">POST</span>
            <code className="text-sm text-bb-text-primary">/api/mcp</code>
          </div>
          <p className="text-sm text-bb-text-muted">JSON-RPC MCP endpoint. 23 tools: search, query, get_page, get_links, get_backlinks, get_timeline, get_health, get_stats, get_graph, list_pages, traverse_graph, list_triggers, pagerank, communities, shortest_path, similar_pages, put_page, delete_page, add_link, remove_link, add_timeline_entry, upsert_trigger, run_triggers.</p>
        </div>
      </section>

      {/* ══════════════ ENRICHMENT API ══════════════ */}
      <section id="enrichment" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">Enrichment API</h2>
        <p className="text-sm text-bb-text-secondary mb-4">
          The enrichment pipeline creates rich, sourced pages for people and companies
          with a single API call. Uses Brave Search for live web research and OpenAI
          for structured template formatting. No manual page building required.
        </p>

        <div className="border border-bb-border rounded-xl overflow-hidden mb-6">
          <div className="bg-bb-bg-secondary px-4 py-3 border-b border-bb-border">
            <h3 className="text-sm font-semibold text-bb-text-primary">Quick Start</h3>
          </div>
          <div className="p-4 bg-bb-bg-primary">
            <pre className="text-xs text-bb-text-secondary overflow-x-auto">
              <code>{`# Enrich a person (Tier 2 — includes Brave web search)
curl -X POST ${baseUrl}/api/brain/enrich \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Satya Nadella","type":"person","tier":2}'

# Response
# {
#   "slug": "people/satya-nadella",
#   "action": "created",
#   "sources": ["brave", "openai"],
#   "_diag": { "braveCalled": true, "braveResults": 5 },
#   "linksCreated": 3,
#   "rawDataStored": 2
# }`}</code>
            </pre>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <h3 className="text-sm font-semibold text-bb-text-primary">Tiers</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { tier: "1", name: "Deep Research", web: "Brave (10 results)", sections: "12 sections", latency: "Async (<5 min)", desc: "Inner circle, key contacts" },
              { tier: "2", name: "Standard", web: "Brave (5 results)", sections: "4 sections", latency: "Sync (<10s)", desc: "Notable entities — recommended default" },
              { tier: "3", name: "Quick Lookup", web: "OpenAI only", sections: "2 sections", latency: "Sync (<5s)", desc: "Quick lookups, no web search" },
            ].map((t) => (
              <div key={t.tier} className="border border-bb-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-bb-accent/10 text-bb-accent text-xs font-mono font-bold rounded">Tier {t.tier}</span>
                  <span className="text-sm font-semibold text-bb-text-primary">{t.name}</span>
                </div>
                <div className="space-y-1 text-xs text-bb-text-muted">
                  <div>Web: {t.web}</div>
                  <div>Sections: {t.sections}</div>
                  <div>Latency: {t.latency}</div>
                  <div className="text-bb-text-secondary pt-1">{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-bb-border rounded-xl overflow-hidden">
          <div className="bg-bb-bg-secondary px-4 py-3 border-b border-bb-border">
            <h3 className="text-sm font-semibold text-bb-text-primary">Request Body</h3>
          </div>
          <div className="p-4 bg-bb-bg-primary space-y-2 text-sm">
            <div className="grid grid-cols-[120px_1fr] gap-2 text-xs">
              <span className="text-bb-text-muted font-mono">name *</span>
              <span className="text-bb-text-secondary">Entity name (e.g., "Satya Nadella", "Stripe")</span>
              <span className="text-bb-text-muted font-mono">type</span>
              <span className="text-bb-text-secondary"><code>person</code>, <code>company</code>, or <code>auto</code> (heuristics — default)</span>
              <span className="text-bb-text-muted font-mono">tier</span>
              <span className="text-bb-text-secondary"><code>1</code>, <code>2</code> (default), or <code>3</code></span>
              <span className="text-bb-text-muted font-mono">context</span>
              <span className="text-bb-text-secondary">Free text about the entity (1.6-1.9x richer pages)</span>
              <span className="text-bb-text-muted font-mono">force</span>
              <span className="text-bb-text-secondary">Re-enrich even if updated within 7 days</span>
            </div>
          </div>
        </div>
      </section>

      <section id="architecture" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">Architecture</h2>
        <p className="text-sm text-bb-text-secondary leading-relaxed mb-4">
          Brainbase uses <strong>polyglot storage</strong>: Supabase Postgres + pgvector as the system of record,
          with an optional Neo4j projection for graph intelligence. Each user gets an isolated brain.
        </p>

        <div className="space-y-4">
          <div className="border border-bb-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-bb-text-primary mb-2">Storage Layer</h3>
            <ul className="text-xs text-bb-text-muted space-y-1">
              <li><strong className="text-bb-text-secondary">Postgres (Supabase)</strong> — Pages, links, timeline entries, embeddings (pgvector), chunks</li>
              <li><strong className="text-bb-text-secondary">Neo4j (optional)</strong> — Graph projection with GDS plugins (PageRank, Louvain, similarity)</li>
            </ul>
          </div>

          <div className="border border-bb-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-bb-text-primary mb-2">Search Pipeline</h3>
            <p className="text-xs text-bb-text-muted">7-stage hybrid search: FTS → vector search → RRF fusion → compiled truth boost → backlink boost → intent re-ranking → structured handlers.</p>
          </div>

          <div className="border border-bb-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-bb-text-primary mb-2">Graph Backend Selection</h3>
            <p className="text-xs text-bb-text-muted mb-2">Set <code className="bg-bb-bg-secondary px-1 rounded">BRAINBASE_GRAPH_BACKEND</code> to control routing:</p>
            <ul className="text-xs text-bb-text-muted space-y-1">
              <li><code className="bg-bb-bg-secondary px-1 rounded">auto</code> (default) — Try Neo4j, fall back to Postgres</li>
              <li><code className="bg-bb-bg-secondary px-1 rounded">postgres</code> — Always Postgres (recursive CTEs)</li>
              <li><code className="bg-bb-bg-secondary px-1 rounded">neo4j</code> — Neo4j only, no fallback</li>
            </ul>
          </div>

          <div className="border border-bb-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-bb-text-primary mb-2">Dream Cycle</h3>
            <p className="text-xs text-bb-text-muted">Nightly autonomous enrichment: extract wikilinks → embed → orphans (semantic links) → patterns → entity tiers → graph-sync.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
