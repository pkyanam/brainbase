# Brainbase — Architecture (v0.4)

> **Current state:** April 30, 2026. This reflects what's actually deployed.

## Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind CSS v4 | ✅ Deployed |
| Database | Supabase Postgres + pgvector | ✅ Production |
| Auth | Clerk v7 (GitHub OAuth) | ✅ Active |
| 3D Graph | Three.js + @react-three/fiber | ✅ Deployed |
| Search | Hybrid (RRF fusion: FTS + pgvector) | ✅ Deployed |
| MCP | JSON-RPC 2.0, 12 tools | ✅ Deployed |
| Background Jobs | Minions queue (Postgres-native) + Dream Cycle crons | ✅ Deployed |
| Embedding | OpenAI text-embedding-3-small | ✅ Active |
| SDK | TypeScript (`brainbase-sdk`) | ✅ Published |
| CLI | `brainbase` command | ✅ Published |

## Architecture

```
Clients
├── Web UI (Three.js 3D graph, dashboard, search)
├── AI Agents (MCP JSON-RPC, REST API)
├── CLI (brainbase query, health, page, graph)
└── SDK (TypeScript, npm)

API Layer (Next.js)
├── GET  /api/brain/health      → Brain stats
├── GET  /api/brain/search?q=   → Hybrid search (FTS + vector + RRF)
├── GET  /api/brain/graph       → Graph data (nodes + edges)
├── GET  /api/brain/page/:slug  → Page content + links + timeline
├── POST /api/mcp               → MCP JSON-RPC (12 tools)
├── POST /api/brain/dream       → Manual dream cycle trigger
└── GET  /api/cron/dream        → Scheduled dream cycle (Vercel cron)

Data Layer
└── Supabase Postgres
    ├── pages (720 rows, 918 chunks)
    ├── links (554 typed edges, from_page_id/to_page_id)
    ├── content_chunks (918 rows, pgvector embeddings)
    ├── timeline_entries (847 rows)
    └── minion_jobs (background job queue)

Background Processing
├── Dream Cycle (daily Vercel cron + external triggers)
│   ├── Extract: wikilinks + timeline from page content
│   ├── Frontmatter: typed edges from YAML frontmatter
│   ├── Embed: OpenAI embeddings for stale chunks (50/cycle)
│   ├── Orphans: detect + auto-link via semantic similarity (10/cycle)
│   ├── Patterns: cross-page co-occurrence detection
│   └── Entity Tiers: auto-escalation based on link count
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

## Current Metrics (April 30, 2026)

| Metric | Value |
|--------|-------|
| Pages | 720 |
| Typed links | 554 |
| Content chunks | 918 |
| Timeline entries | 847 |
| Orphans | 497 |
| Brain score | 76/100 |

## Search Eval (50-pair ground truth, v1.7)

| Metric | Value |
|--------|-------|
| MRR | 0.83 |
| P@3 | 0.49 |
| P@10 | 0.41 |
| R@10 | 0.85 |
| Intent accuracy | 51% |
| p50 latency | 619ms |
| p95 latency | 1401ms |

## What We Learned

- **CLI wrapper was a bottleneck.** Direct Supabase queries replaced GBrain CLI subprocess. 15s timeout → 500ms.
- **D3.js 2D was wrong.** Three.js 3D with instanced rendering handles 720 nodes at 60fps.
- **PGLite is dead.** macOS 26.3 XProtect kills WASM. Supabase only.
- **Fake scoring was everywhere.** Phase 1 replaced hardcoded ladders with real ts_rank_cd + pgvector similarity.
- **Minions queue shipped incomplete.** The embed handler was a `'[pending]'` stub for weeks. Phase 3 fixed it.
- **Dream cycle was aspirational.** Cron submitted jobs to a queue with no worker. Phase 3 wired it directly.
- **Embed coverage is the search quality ceiling.** 37% → we're working on it.
