# Changelog

## Unreleased (v0.4) — April 30, 2026

### Consolidation Phase 1 — Neo4j layer absorbed from GraphBrain
- New `src/lib/neo4j/` subsystem (driver + engine, ~700 LoC) ported from the standalone GraphBrain repo
- `neo4j-driver@^6.0.1` added as a dependency (lazy-loaded via dynamic import — no impact on cold start when Neo4j is unconfigured)
- Single-DB mode default ON: one Neo4j database, brain isolation via `brain_id` property — works on AuraDB free tier
- Engine is wired but inert: nothing in the request path uses it yet. Phase 2 introduces the graph-sync dream phase that populates it from Postgres
- New env vars: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `NEO4J_SINGLE_DB`

### Consolidation Phase 6 — Public wiki
- Schema: `pages.public BOOLEAN`, `brains.wiki_enabled`, `brains.wiki_title`, `brains.wiki_tagline` (all idempotent via `ensureWikiSchema()`)
- Filtered index `idx_pages_public_brain` on `(brain_id, slug) WHERE public = TRUE` — wiki list query is one B-tree seek
- New `src/lib/wiki.ts` — read-only data layer enforcing the two-predicate gate (brain.wiki_enabled AND page.public). Linked-page leakage explicitly prevented (links to private pages are filtered out before render)
- New routes:
  - `/b/[brainSlug]` — wiki home, group-by-type directory
  - `/b/[brainSlug]/[...slug]` — Wikipedia-style page with sidebar (metadata + connections), backlinks, timeline
  - `/api/wiki/[brainSlug]` and `/api/wiki/[brainSlug]/page/[...slug]` — anonymous JSON API for agents that want to read someone else's published brain
  - `/api/brain/wiki` (owner GET/POST) — toggle wiki, set title/tagline
  - `/api/brain/wiki/page` (owner POST) — flip a single page public/private
- Render is intentionally minimal: paragraph splitting + links via Next `<Link>`. A proper markdown pipeline lands when the wiki ships richer content.

### Consolidation Phase 5 — Graph intelligence (the moat)
- New `src/lib/neo4j/intel.ts` — PageRank, Louvain communities, shortest-path, node similarity
- 4 new REST routes: `/api/brain/intel/{pagerank, communities, shortest-path, similar}`
- 4 new MCP tools: `pagerank`, `communities`, `shortest_path`, `similar_pages` — total now 23
- Graceful degradation: GDS plugin used when available, sensible fallbacks otherwise (degree centrality for PageRank, Jaccard for similarity). `shortest_path` uses native Cypher and is always available.
- GDS feature-detected once per process via `gds.version()` — zero overhead per request
- Each response includes `algorithm` field so the dashboard can show which engine produced the result

### Consolidation Phase 4 — Zero-friction provisioning
- New `POST /api/provision` — no Clerk, no signup, returns `{ brain_id, api_key, url, mcp_url, wiki_url, dashboard, endpoints }` in one round-trip
- New `GET /api/provision/install` serves the bash installer at text/plain content-type so `curl -fsSL <base>/api/provision/install | sh` works end-to-end
- New `scripts/provision.sh` — POSIX-friendly installer that writes `~/.brainbase/{config,mcp}.json`, prints the (one-time) key, and is safe to pipe into `sh`
- Best-effort Neo4j projection init at provision time so the first traversal call doesn't pay cold-init cost (failures don't block provisioning)
- New `src/lib/rate-limit.ts` — in-memory sliding-window IP limiter; provisioning is capped at 5/min and 30/hr per IP
- Synthetic owner identity `agent_<random>` lets agents claim a brain immediately; users can later link it to a Clerk account from `/apply`

### Consolidation Phase 3 — Neo4j-backed traversal + graph reads
- New `src/lib/graph-router.ts` decides per-request which backend serves graph reads
- `/api/brain/traverse`, `/api/brain/graph`, and the MCP `traverse_graph` + `get_graph` tools now go through the router
- Default behavior: try Neo4j → fall back to Postgres on any error or when the projection is empty for a brain. A Neo4j outage cannot take down the dashboard.
- New env var `BRAINBASE_GRAPH_BACKEND` (`auto` | `postgres` | `neo4j`) — `auto` is default; `neo4j` disables fallback (strict mode)
- Responses now carry `_backend` and `_fell_back` diagnostic fields so the dashboard can show which engine served the request

### Consolidation Phase 2 — Graph-sync dream phase
- New `src/lib/neo4j/sync.ts`: watermark-based, idempotent Postgres → Neo4j projection sync
- `neo4j_sync_state` table tracks `last_pages_synced_at`, totals, last status/error per brain (auto-created on first run)
- New phase `graph_sync` runs at the end of `runDreamCycle()`; gracefully reports `skipped` when `NEO4J_URI` is unset
- Phase orchestrator at `/api/cron/dream-phase` now accepts `phase: "graph_sync"`; pass `limit: 0` to force a full resync
- New `GET/POST /api/brain/graph-sync`: read sync state and trigger on-demand re-sync (dashboard button hookup)
- Per-page edge rebuild strategy: when a page's `updated_at` advances, its outgoing edges in Neo4j are dropped and re-inserted from Postgres — keeps the projection consistent without needing per-link timestamps

### Phase 1 — Search Quality Overhaul
- Hybrid search with RRF fusion (keyword + pgvector)
- 7-stage gated search pipeline (AND FTS → OR FTS → chunks → timeline → pg_trgm → ILIKE)
- Query intent classifier (temporal, entity, event, general) with proper noun heuristic
- Exact match pinning at rank 0 + absolute score pinning (100.0)
- Vector minimum similarity threshold (0.55) — kills the "magnet" page problem
- Alias expansion for acronyms and abbreviations (YC, UVA, MIT, etc.)
- Question prefix stripping ("who is X" → "X")
- Compiled truth boost (1.15x), backlink boost, dedup-by-slug
- Phase 1.6: Relational intent patterns, possessive stripping, bug/issue detection

### Phase 2 — Minions Job Queue
- Postgres-native background job queue (submit, claim, complete, fail, retry)
- 4 handlers: embed, extract, backlinks, sync
- Cron-driven batch processing (serverless-safe, 55s lock duration)

### Phase 3 — Content Pipeline
- Embed handler: real OpenAI text-embedding-3-small (was `'[pending]'` stub)
- Dream cycle rewired — cron calls runDreamCycle() directly
- Embed batch: 20 → 50 chunks per cycle
- Orphan auto-linking via semantic similarity (10/cycle)
- Brain score: 39 → 76

### Search Eval
- 50-pair ground truth with reproducible harness
- MRR 0.83, P@3 0.49, R@10 0.85
- Relational MRR: 0.49 → 0.78 (Phase 1.6)
- Multi-entity MRR: 0.50 → 0.75 (Phase 1.6)

## 0.3.0 — April 29, 2026

### Added
- Multi-tenant API key system — each user gets their own brain and API keys
- `/settings` page for API key management (create, revoke, copy)
- `/pricing` page with Free, Pro, Enterprise tiers
- `/terms` and `/privacy` pages
- `robots.txt` and `sitemap.xml` routes
- Shared `Nav` and `Footer` components across all pages
- Reusable `SafeClerk` auth components for dev-mode tolerance
- SDK compiled and ready for npm publish
- CLI updated to support `BRAINBASE_API_KEY` env var

### Changed
- MCP endpoint (`/api/mcp`) now requires `Authorization: Bearer` header
- `/b/[username]/` routes ported from old engine to direct Supabase
- Landing page redesigned with cleaner CTAs and feature grid
- Dashboard shows API key banner and auth state
- Docs page expanded with API reference section

### Fixed
- Clerk v7 compatibility — updated all auth props
- SQL syntax error in schema setup (escaped apostrophe)
- TypeScript errors with `useRef` in React 19

## 0.2.0 — April 28, 2026

### Added
- Direct Supabase layer — replaced GBrain CLI wrapper with raw Postgres queries
- 4 REST API endpoints: health, search, page, graph
- MCP server with 7 tools (JSON-RPC + SSE + stdio)
- CLI tool with 6 commands
- Three.js 3D graph with instanced rendering
- Dynamic imports for Three.js to prevent SSR issues

### Fixed
- iPhone WebGL context loss — added recovery and low-power mode
- React state causing context loss on click — stripped from Canvas

## 0.1.0 — April 27, 2026

- Initial prototype
- Next.js 16 + Clerk + Supabase
- Basic dashboard with stats and search
- D3.js graph (later replaced with Three.js)
