# Brainbase

**The memory layer for AI agents.** One API call, and every agent in your stack remembers everything.

[![Brain Score](https://img.shields.io/badge/brain_score-76%2F100-brightgreen)](#)
[![Search MRR](https://img.shields.io/badge/search_MRR-0.83-blue)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## What It Is

Brainbase gives AI agents persistent memory. Each user gets an isolated Postgres knowledge graph (Supabase + pgvector) that agents read from and write to. The brain enriches itself in the background — extracting links, building timelines, reconnecting orphans, escalating entity importance.

**The insight:** the value of a knowledge brain is directly proportional to how automatically it's used. Brainbase runs a nightly "dream cycle" that keeps your brain healthy without any human input.

## Why

Every AI agent today starts every task from zero context. They don't know who you are, who you work with, what you built last week, or what you decided in that meeting. Brainbase fixes that. It's the missing layer between raw company data and reliable AI automation — exactly what YC's Tom Blomfield called for in the [Company Brain RFS](https://www.ycombinator.com/rfs#company-brain).

## Live Demo

**[brainbase.belweave.ai](https://brainbase.belweave.ai)** — Preetham Kyanam's own brain, 720 pages, 554 typed links, 3D knowledge graph.

## Current State (April 30, 2026)

| Metric | Value |
|--------|-------|
| Pages | 720 |
| Typed links | 554 |
| Content chunks | 918 |
| Timeline entries | 847 |
| Brain score | 76/100 |
| Orphans | 497 (auto-linking at 60/day) |

## Search Quality

We track retrieval quality with a 50-pair labeled ground truth and reproducible eval harness. MRR is our north star.

| Metric | Value |
|--------|-------|
| **MRR** | 0.83 |
| **P@3** | 0.49 |
| **P@10** | 0.41 |
| **R@10** | 0.85 |
| Relational MRR | 0.78 |
| Multi-entity MRR | 0.75 |
| p50 latency | 619ms |
| p95 latency | 1401ms |

**Search pipeline:** 7-stage gated search (FTS AND → FTS OR + synonyms → chunk FTS → timeline FTS → pg_trgm → ILIKE fallback), reciprocal rank fusion with pgvector, compiled truth boost, backlink boost, intent classifier (temporal/entity/event/general), acronym expansion.

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
// → { page_count: 720, brain_score: 76, link_count: 554 }

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
├── pages (720)
├── links (554 typed edges)
├── content_chunks (pgvector, 918 chunks)
├── timeline_entries (847)
└── minion_jobs (background queue)

Background (Dream Cycle)
├── Extract: wikilinks + timeline from pages (200/cycle)
├── Frontmatter: typed edges from YAML
├── Embed: OpenAI text-embedding-3-small (50/cycle)
├── Orphans: auto-link via semantic similarity (10/cycle)
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
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CRON_SECRET=...          # secures /api/cron/dream
HERMES_CRON_SECRET=...   # alternative secret for external cron triggers
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

## Multi-Agent Proof Point

Brainbase already runs against Preetham's brain with 4 agents from different frameworks sharing the same graph:

- **Lara** — conversational agent (Telegram + web)
- **Arlan** — iMessage agent (Folk-based)
- **Hermes** — task agent (Hermes CLI)
- **Jerry** — utility agent

Every agent reads the same brain. Every agent's work enriches it. No manual data entry.

## License

MIT
