# Changelog

## Unreleased (v0.4) — April 30, 2026

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
