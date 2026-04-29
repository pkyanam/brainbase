# Changelog

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
- Clerk v7 compatibility — updated all auth props (`fallbackRedirectUrl`, etc.)
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
