"use client";

import { useState, useEffect } from "react";

const ONBOARDING_MD = `# Agent Onboarding: Brainbase

> **For:** New AI agent (Hermes-based)
> **Owner:** Preetham Kyanam
> **Brainbase URL:** \`https://brainbase.belweave.ai\`
> **API Key:** \`BB_API_KEY_PLACEHOLDER\` ← **replace before use**

---

## 1. What You Have Access To

You are an autonomous agent with **persistent memory** via Brainbase — a knowledge graph + vector database that stores everything your owner learns, reads, and cares about.

**Your job:** Read from the brain before answering. Write to the brain when you learn something new. Link related concepts so the graph stays connected.

---

## 2. Authentication

All write operations (and MCP calls) require an API key:

\`\`\`
Authorization: Bearer <BB_AP...DER>
\`\`\`

**Base URL:** \`https://brainbase.belweave.ai/api/mcp\`

**Multi-brain support:** If you need to access a brain other than your default, add:
\`\`\`
X-Brain-Id: <brain-uuid>
\`\`\`

---

## 3. MCP Tools (19 Available)

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
| \`list_pages\` | List pages with filters | \`type?, limit?, offset?\` |
| \`traverse_graph\` | Walk the graph from a page | \`slug, depth?, direction?\` |
| \`list_triggers\` | List active trigger rules | — |

### Write Tools (quota-limited)

| Tool | Purpose | Key Params |
|------|---------|------------|
| \`put_page\` | Create/update a page | \`slug, title, type?, content?, frontmatter?\` |
| \`delete_page\` | Remove a page | \`slug\` |
| \`add_link\` | Create typed link | \`from, to, link_type?\` |
| \`remove_link\` | Remove a link | \`from, to\` |
| \`add_timeline_entry\` | Add event to timeline | \`slug, date, summary, detail?, source?\` |
| \`upsert_trigger\` | Create automation rule | \`name, conditions, actions\` |
| \`run_triggers\` | Manually fire rules on page | \`slug, title, type?, content?\` |

---

## 4. How to Think About the Brain

### Page Structure
Every page has:
- **slug** — unique ID (e.g., \`people/garry-tan\`, \`email/jarvis/2026-04-29/security-alert\`)
- **type** — \`person\`, \`company\`, \`project\`, \`concept\`, \`email\`, \`idea\`, etc.
- **content** — markdown body
- **links** — typed connections to other pages (\`related\`, \`works_at\`, \`invested_in\`, \`founded\`, etc.)
- **timeline** — dated events
- **embeddings** — vector representation for semantic search

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

---

## 6. Important Rules

### DO
- **Search the brain first** before using external APIs or claiming ignorance
- Use descriptive slugs: \`people/first-last\`, \`companies/company-name\`, \`projects/project-name\`
- Include frontmatter with \`type\`, \`date\`, and \`source\`
- Link related pages — isolated pages are useless
- Write in markdown with headers for structure
- Use timeline entries for dated events

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
| \`person\` | People your owner knows | \`people/jon-corpuz\` |
| \`company\` | Companies, orgs | \`companies/openai\` |
| \`project\` | Code projects, initiatives | \`projects/brainbase\` |
| \`concept\` | Ideas, frameworks, CVEs | \`concepts/rag-pipeline\` |
| \`email\` | Ingested emails | \`email/jarvis/2026-04-29/subject\` |
| \`idea\` | Raw thoughts, brainstorming | \`ideas/agent-email-integration\` |
| \`place\` | Locations, venues | \`places/belmont-va\` |

---

## 8. Troubleshooting

| Issue | Fix |
|-------|-----|
| \`401 Unauthorized\` | API key missing or invalid |
| \`403 Forbidden\` | You don't have access to that brain |
| \`404 Page not found\` | Slug doesn't exist — create it or check spelling |
| Quota exceeded | Write operations are rate-limited; wait or ask owner |
| Graph empty | Brain has < 2 pages or no links — start adding content |

---

## 9. Architecture Notes (For Debugging)

- **Database:** Supabase Postgres with pgvector
- **Search:** Hybrid full-text + semantic (embeddings)
- **Graph:** Typed wikilinks stored as edge rows
- **Pipeline:** \`put_page\` → embeddings → auto-extract (wikilinks + dates + semantic links) → triggers → actions
- **Hosting:** Vercel, edge-cached reads

---

## 10. Owner Preferences (Learned)

- **Product honesty matters.** Don't claim features work if they don't.
- **Agent-first architecture.** You operate in your own session, not inside the web app.
- **Privacy.** Owner's data goes to OWNER'S brain only. Never wire personal integrations into the product.
- **Scout-level UI.** Clean, minimal, no AI slop.
- **DeepSeek-V4-Pro** is the primary model. GPT-5.5 is fallback (quota-limited).
- **Budget conscious.** Minimize unnecessary API calls.

---

**Last updated:** 2026-04-29
**Questions?** Ask Preetham or check the brain for \`brainbase\` docs.
`;

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
        <div className="bg-bb-bg-secondary border border-bb-border rounded-xl p-5">
          <pre className="text-sm text-bb-text-secondary overflow-x-auto">
            <code>{`npm install brainbase-cli`}</code>
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
brainbase config set baseUrl ${baseUrl}
brainbase search "Garry Tan"
brainbase health --json | jq '.brain_score'`} label="Copy" />
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
brainbase page people/garry-tan
brainbase links people/garry-tan
brainbase graph --json | jq '.nodes | length'
brainbase traverse people/garry-tan --depth 2

# Write
brainbase put-page ideas/new-thing "My Idea" --type idea --content "# Hello"
cat note.md | brainbase put-page ideas/new-thing "My Idea" --type idea --stdin
brainbase add-link people/garry-tan companies/y-combinator --type works_at
brainbase add-timeline people/garry-tan "2024-03-01" "Became YC CEO"

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
                <p className="text-xs text-bb-text-muted mt-0.5">For Node.js / Bun apps. Same MCP endpoint underneath.</p>
              </div>
              <CopyButton text={`npm install brainbase-sdk`} label="Copy" />
            </div>
            <div className="p-4 bg-bb-bg-primary">
              <pre className="text-xs text-bb-text-secondary overflow-x-auto">
                <code>{`import { Brainbase } from "brainbase-sdk";

const brain = new Brainbase({
  apiKey: "bb_live_...",
  baseUrl: "${baseUrl}",
});

// Read
const results = await brain.search("Garry Tan");     // [{slug, title, score}]
const page    = await brain.getPage("people/garry-tan");
const health  = await brain.health();                // {page_count, link_count, brain_score}
const graph   = await brain.graph();                 // {nodes, edges}

// Write
await brain.putPage({
  slug: "ideas/new-thing",
  title: "My New Idea",
  type: "idea",
  content: "# Markdown",
});
await brain.addLink("people/garry-tan", "companies/y-combinator", "works_at");`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section id="api" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">API Reference</h2>
        <p className="text-sm text-bb-text-secondary mb-4">All read endpoints are public. Write endpoints require API key auth.</p>

        <h3 className="text-sm font-semibold text-bb-text-primary mb-3">Read</h3>
        <div className="space-y-3 mb-8">
          {[
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/health", desc: "Brain statistics and health score." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/stats", desc: "Detailed brain statistics (pages by type, embed coverage, most connected)." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/search?q=...", desc: "Full-text + ILIKE search across all pages." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/list?type=&limit=&offset=", desc: "List all pages with metadata. Filter by type." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/page/<slug>", desc: "Single page with content, links, and timeline." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/timeline/<slug>", desc: "Timeline entries for a page." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/graph", desc: "Full knowledge graph (nodes + edges)." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/traverse?slug=&depth=&direction=", desc: "Graph traversal from a page (out/in/both, max depth 5)." },
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
            { method: "PUT", color: "bg-bb-accent-dim/20 text-bb-accent-dim", path: "/api/brain/page/<slug>", desc: "Create or update a page. Body: {title, type?, content?, frontmatter?}" },
            { method: "DELETE", color: "bg-red-900/20 text-red-400", path: "/api/brain/page/<slug>", desc: "Delete a page and its associated data." },
            { method: "POST", color: "bg-bb-accent-dim/20 text-bb-accent-dim", path: "/api/brain/link", desc: "Create a link. Body: {from, to, link_type?}" },
            { method: "DELETE", color: "bg-red-900/20 text-red-400", path: "/api/brain/link", desc: "Remove a link. Body: {from, to}" },
            { method: "POST", color: "bg-bb-accent-dim/20 text-bb-accent-dim", path: "/api/brain/timeline", desc: "Add timeline entry. Body: {slug, date, summary, detail?, source?}" },
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

        <h3 className="text-sm font-semibold text-bb-text-primary mb-3">MCP</h3>
        <div className="border border-bb-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-0.5 bg-bb-accent-glow text-bb-accent text-xs font-mono rounded">POST</span>
            <code className="text-sm text-bb-text-primary">/api/mcp</code>
          </div>
          <p className="text-sm text-bb-text-muted">JSON-RPC MCP endpoint. 19 tools: search, query, get_page, get_links, get_backlinks, get_timeline, get_health, get_stats, get_graph, list_pages, traverse_graph, put_page, delete_page, add_link, remove_link, add_timeline_entry, upsert_trigger, list_triggers, run_triggers.</p>
        </div>
      </section>

      <section id="architecture" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">Architecture</h2>
        <p className="text-sm text-bb-text-secondary leading-relaxed">
          Brainbase is built on{" "}
          <a href="https://github.com/garrytan/gbrain" className="text-bb-accent hover:underline">GBrain</a>{" "}
          by Garry Tan. Each user gets their own isolated Postgres database on Supabase
          with pgvector for hybrid search. The knowledge graph uses typed wikilinks for relational
          queries that vector search alone can&apos;t reach.
        </p>
      </section>
    </div>
  );
}
