# Brainbase — Architecture

> **Current state:** May 3, 2026. This reflects what's actually deployed.

## Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind CSS v4 | ✅ Deployed |
| Database | Polyglot: Supabase Postgres + pgvector + Neo4j | ✅ Production |
| Auth | Clerk v7 (GitHub OAuth) | ✅ Active |
| 3D Graph | Three.js + @react-three/fiber | ✅ Deployed |
| Search | Hybrid (RRF fusion: FTS + pgvector) | ✅ Deployed |
| Graph Intelligence | Neo4j GDS: PageRank, Louvain, shortest path, similarity | ✅ Deployed |
| Graph Router | Auto-selection Neo4j → Postgres fallback | ✅ Deployed |
| MCP | JSON-RPC 2.0, 23 tools | ✅ Deployed |
| Background Jobs | Minions queue (Postgres-native) + Dream Cycle crons + graph-sync | ✅ Deployed |
| Embedding | OpenAI text-embedding-3-small | ✅ Active |
| SDK | TypeScript (`brainbase-sdk`) | ✅ Published |
| CLI | `brainbase` command | ✅ Published |
| Provisioning | Self-service via `/api/provision` | ✅ Deployed |
| Public Wiki | Per-brain public wikis | ✅ Deployed |

## Architecture

```
Clients
├── Web UI (Three.js 3D graph, dashboard, search)
├── AI Agents (MCP JSON-RPC, REST API)
├── CLI (brainbase query, health, page, graph, pagerank)
└── SDK (TypeScript, npm)

API Layer (Next.js)
├── GET  /api/brain/health           → Brain stats
├── GET  /api/brain/search?q=        → Hybrid search (FTS + vector + RRF)
├── GET  /api/brain/graph            → Graph data (nodes + edges, via router)
├── GET  /api/brain/traverse         → Graph traversal (via router)
├── GET  /api/brain/page/:slug       → Page content + links + timeline
├── GET  /api/brain/graph-sync       → Trigger Postgres → Neo4j sync
├── GET  /api/brain/intel/*          → Graph intelligence endpoints
│   ├── pagerank                     → PageRank centrality
│   ├── communities                  → Louvain communities
│   ├── shortest-path                → Shortest path between nodes
│   └── similar                      → Node similarity
├── POST /api/provision              → Self-service brain creation
├── POST /api/mcp                    → MCP JSON-RPC (23 tools)
├── POST /api/brain/dream            → Manual dream cycle trigger
└── GET  /api/cron/dream             → Scheduled dream cycle (Vercel cron)

Graph Router (src/lib/graph-router.ts)
├── Selects backend per request: Postgres or Neo4j
├── Config: BRAINBASE_GRAPH_BACKEND (auto|postgres|neo4j)
└── Auto: Try Neo4j, fall back to Postgres on any error

Data Layer (Polyglot)
├── Postgres (Supabase) — System of Record
│   ├── pages
│   ├── links (typed edges, from_page_id/to_page_id)
│   ├── content_chunks (pgvector embeddings)
│   ├── timeline_entries
│   ├── neo4j_sync_state (watermark for graph projection)
│   └── minion_jobs (background job queue)
└── Neo4j — Derived Graph Projection
    ├── Nodes (pages)
    ├── Relationships (links as edges)
    └── GDS Plugins (PageRank, Louvain, similarity)

Background Processing
├── Dream Cycle (daily Vercel cron + external triggers)
│   ├── Extract: wikilinks + timeline from page content
│   ├── Frontmatter: typed edges from YAML frontmatter
│   ├── Embed: OpenAI embeddings for stale chunks
│   ├── Orphans: detect + auto-link via semantic similarity
│   ├── Patterns: cross-page co-occurrence detection
│   ├── Entity Tiers: auto-escalation based on link count
│   └── Graph Sync: Postgres → Neo4j projection (idempotent, watermark-based)
└── Minions Queue (cron-driven batch ticks)
    ├── embed — OpenAI embedding generation
    ├── extract — wikilink + timeline parsing
    ├── backlinks — reciprocal link enforcement
    └── sync — brain re-index (skeleton)
```

## Multi-Tenancy

Each user gets an isolated brain via `brain_id` column on all tables. Auth via Clerk JWT → `brain_id` lookup. API keys are `bb_live_*` format, SHA-256 hashed, prefix stored for display.

## Search Pipeline

```
Query → expandQuery (aliases) → classifyIntent → hybrid search

Hybrid search:
  Keyword (FTS tsvector) ──┐
  Vector (pgvector cosine) ─┤→ dedupBySlug → RRF fusion → normalize
                            │     → exact match pin → compiled truth boost
                            │     → backlink boost → dedup → sort → return
                            │
  Stages (gated):
    1. FTS AND (primary, ts_rank_cd)
    2. FTS OR with synonyms (if score < 0.25)
    3. Content chunks FTS (if score < 0.25)
    4. Timeline entries FTS (always, ×0.9)
    5. pg_trgm title (always)
    6. pg_trgm content (if score < 0.25)
    7. ILIKE fallback (last resort)
```

## What We Learned

- **CLI wrapper was a bottleneck.** Direct Supabase queries replaced GBrain CLI subprocess. 15s timeout → 500ms.
- **D3.js 2D was wrong.** Three.js 3D with instanced rendering handles large graphs at 60fps.
- **PGLite is dead.** macOS 26.3 XProtect kills WASM. Supabase only.
- **Fake scoring was everywhere.** Phase 1 replaced hardcoded ladders with real ts_rank_cd + pgvector similarity.
- **Minions queue shipped incomplete.** The embed handler was a `'[pending]'` stub for weeks. Phase 3 fixed it.
- **Dream cycle was aspirational.** Cron submitted jobs to a queue with no worker. Phase 3 wired it directly.
- **Embed coverage is the search quality ceiling.** Continuous improvement via dream cycle.
