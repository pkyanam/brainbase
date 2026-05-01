# Brainbase

**The memory layer for AI agents.** One API call, and every agent in your stack remembers everything.

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## What It Is

Brainbase gives AI agents persistent memory. Each user gets an isolated Postgres knowledge graph (Supabase + pgvector) that agents read from and write to. The brain enriches itself in the background — extracting links, building timelines, reconnecting orphans, escalating entity importance.

**The insight:** the value of a knowledge brain is directly proportional to how automatically it's used. Brainbase runs a nightly "dream cycle" that keeps your brain healthy without any human input.

## Why

Every AI agent today starts every task from zero context. They don't know who you are, who you work with, what you built last week, or what you decided in that meeting. Brainbase fixes that. It's the missing layer between raw company data and reliable AI automation — exactly what YC's Tom Blomfield called for in the [Company Brain RFS](https://www.ycombinator.com/rfs#company-brain).

## Live Demo

**[brainbase.belweave.ai/demo](https://brainbase.belweave.ai/demo)** — interactive 3D knowledge graph built from a real personal brain. Search, explore, see the dream cycle in action.

## Search Pipeline

Hybrid search (Postgres FTS + pgvector) with reciprocal rank fusion, intent classifier, and type-aware re-ranking.

**Pipeline:** 7-stage gated FTS → vector search → RRF fusion → compiled truth boost → backlink boost → intent-aware re-ranking → structured query handlers.

## Quick Start

```bash
npm install brainbase-sdk
```

```ts
import { Brainbase } from "brainbase-sdk";

const brain = new Brainbase({ apiKey: "bb_live_..." });

// Natural language query
const results = await brain.query("who do I know at YC?");
// → [{ slug: "people/garry-tan", title: "Garry Tan", score: 0.97 }]

// Read a page
const page = await brain.getPage("people/garry-tan");

// Brain health
const health = await brain.health();

// Knowledge graph
const graph = await brain.graph();
// → { nodes: [...], edges: [...] }
```

### MCP (Model Context Protocol)

Drop this into any MCP-compatible agent (Claude Code, Cursor, OpenCode, ChatGPT desktop):

```json
{
  "mcpServers": {
    "brainbase": {
      "url": "https://brainbase.belweave.ai/api/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer bb_live_..."
      }
    }
  }
}
```

12 tools available: `search`, `query`, `get_page`, `get_links`, `get_backlinks`, `get_timeline`, `get_health`, `get_stats`, `get_graph`, `list_pages`, `traverse_graph`, `list_triggers`.

### CLI

```bash
brainbase search "garry tan"
brainbase health
brainbase page "people/garry-tan"
brainbase links "people/preetham-kyanam"
brainbase graph
```

## Architecture

```
Clients
├── Web UI (Three.js 3D graph, search, dashboard)
├── AI Agents (MCP JSON-RPC, REST API)
├── CLI (brainbase)
└── SDK (TypeScript, npm)

API (Next.js 16)
├── REST: health, search, page, graph
├── MCP: 12-tool JSON-RPC server
├── Cron: nightly dream cycle
└── Public: /b/<user>/api/status, /b/<user>/llms.txt

Database (Supabase)
├── pages
├── links (typed edges)
├── content_chunks (pgvector)
├── timeline_entries
└── minion_jobs (background queue)

Background (Dream Cycle)
├── Extract: wikilinks + timeline from pages
├── Frontmatter: typed edges from YAML
├── Embed: OpenAI text-embedding-3-small
├── Orphans: auto-link via semantic similarity
├── Patterns: cross-page co-occurrence detection
└── Entity Tiers: auto-escalation
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, Three.js |
| Database | Supabase Postgres + pgvector |
| Auth | Clerk v7 (GitHub OAuth) |
| Search | Hybrid (FTS + pgvector), RRF fusion |
| Embedding | OpenAI text-embedding-3-small (1536-dim) |
| Background | Dream cycle crons + Minions job queue |
| SDK | TypeScript (`brainbase-sdk` on npm) |
| CLI | Node.js (`brainbase`) |
| Hosting | Vercel (Hobby plan) |

## Development

```bash
git clone https://github.com/pkyanam/brainbase.git
cd brainbase
npm install
npm run dev        # → http://localhost:5174
```

Required env vars in `.env.local`:

```bash
SUPABASE_DATABASE_URL=postgresql://...
OPENAI_API_KEY=***
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=***
CRON_SECRET=***          # secures /api/cron/dream
HERMES_CRON_SECRET=***   # alternative secret for external cron triggers
```

## Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/brain/health` | GET | Bearer | Brain statistics |
| `/api/brain/search?q=` | GET | Bearer | Hybrid search |
| `/api/brain/page/<slug>` | GET | Bearer | Page with links + timeline |
| `/api/brain/graph` | GET | Bearer | Graph data (nodes + edges) |
| `/api/mcp` | POST | Bearer | MCP JSON-RPC (12 tools) |
| `/api/cron/dream` | GET | CRON_SECRET | Trigger dream cycle |
| `/api/brain/dream` | POST | Bearer | Manual dream trigger |
| `/b/<user>/api/status` | GET | Public | Public brain stats |
| `/b/<user>/llms.txt` | GET | Public | Agent-readable summary |

## License

MIT
