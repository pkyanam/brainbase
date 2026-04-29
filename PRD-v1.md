# Brainbase — MVP v1.0 PRD (Clean Slate)

> **Status:** Draft  | **Timeline:** 2-3 days  | **Stack:** Next.js 16 + Supabase + Three.js + MCP  
> **Goal:** Agent-first personal knowledge brain. Web UI is a client, not the product.

---

## 0. What We Learned from v0.3

**What worked:**
- GBrain on Supabase (671 pages, 854 chunks, 100% embedded)
- Clerk + GitHub OAuth (working auth)
- Signal detection + enrichment crons (autonomous pipeline)
- Agent persona (Lara on Telegram) using the brain

**What didn't:**
- **GBrain CLI shell wrapper is a bottleneck.** `execSync("gbrain get...")` spawns a subprocess per API call. 15s timeout. Not scalable.
- **D3.js 2D graph is wrong.** Preetham wants Three.js 3D. 2D can't show link density.
- **Fake graph links.** `getLinks()` generates synthetic edges by type-matching. Not real data.
- **PGLite is dead.** macOS 26.3 XProtect v5341 kills WASM. Supabase only.
- **No real MCP.** Routes proxy to CLI. Not a proper MCP server.
- **Web-app-first architecture.** Dashboard is the product. Should be agent-first.

**What changes:**
- Talk to Supabase directly. No GBrain CLI.
- Three.js 3D graph with real edges from `brain_links` table.
- Proper MCP server with tool dispatch.
- Agent-first API surface. Web UI renders from the same APIs agents use.
- Single brain (Preetham's). Multi-tenant later.

---

## 1. Product Overview

### 1.1 One Breath
**Brainbase turns your GBrain into an agent-queryable 3D knowledge universe.**

### 1.2 What Changes from v0.3

| v0.3 (Current) | v1.0 (Target) |
|---|---|
| GBrain CLI subprocess per request | Direct Supabase queries |
| D3.js 2D force graph | Three.js 3D force graph |
| Fake synthetic edges | Real edges from brain_links |
| MCP routes proxy to CLI | Proper MCP tool dispatch |
| Web app with agent endpoints | Agent-first API + web client |
| PGLite (dead) + Supabase | Supabase only |
| Next.js 15 | Next.js 16 |

### 1.3 What v1.0 Is NOT
- Not multi-tenant (single brain — Preetham's)
- Not an ingestion platform (no OAuth connectors)
- Not a GBrain replacement (uses GBrain's Supabase schema)
- Not a team/org tool
- Not a no-code builder

---

## 2. Architecture

```
┌──────────────────────────────────────────────┐
│                  CLIENTS                      │
│                                               │
│  Web UI (Three.js)   │   AI Agents (MCP)     │
│  /dashboard          │   POST /mcp           │
│                       │   curl /api/search    │
└──────────┬───────────────┬────────────────────┘
           │               │
┌──────────▼───────────────▼────────────────────┐
│           Next.js API Layer                     │
│                                                 │
│  GET  /api/brain/health     Brain stats         │
│  GET  /api/brain/search?q=  Hybrid search       │
│  GET  /api/brain/graph       Graph data (3D)    │
│  GET  /api/brain/page/:slug Page content        │
│  POST /api/mcp               MCP JSON-RPC       │
│  GET  /llms.txt             Agent discovery     │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│              Supabase (GBrain schema)             │
│                                                    │
│  Tables: pages, links, timeline, chunks, ...      │
│  Extensions: pgvector, pg_graphql                 │
└───────────────────────────────────────────────────┘
```

---

## 3. What We Build (3 Features Only)

### Feature 1: Brain API (Direct Supabase)

**What:** Clean API that queries GBrain's Supabase tables directly. No CLI subprocess. No fake data.

**Endpoints:**
```
GET /api/brain/health          → { page_count, link_count, brain_score, ... }
GET /api/brain/search?q=...    → [{ slug, title, type, score, excerpt }]
GET /api/brain/graph            → { nodes: [...], edges: [...] }
GET /api/brain/page/:slug      → { slug, title, type, content, frontmatter, links }
```

**Data sources (GBrain Supabase tables):**
- `brain_pages` → page CRUD
- `brain_links` → real graph edges (not synthetic)
- `content_chunks` → vector search via pgvector
- `brain_stats` → health/score

**Tech:** `@supabase/supabase-js` with service role key. Server-side only. No client-side DB access.

**Acceptance:** All four endpoints return real data from Preetham's brain within 500ms.

---

### Feature 2: MCP Server (Agent-First)

**What:** Real MCP JSON-RPC server at `POST /api/mcp`. Agents connect here. This is the PRIMARY product surface.

**Tools exposed (from GBrain's 30+ tool set):**
```
search         — hybrid search (vector + keyword)
get_page       — read a brain page
query          — natural language query
get_links      — outgoing links from a page
get_backlinks  — incoming links to a page
get_health     — brain stats dashboard
get_graph      — full graph data for visualization
```

**Protocol:** JSON-RPC 2.0 over HTTP POST. Standard MCP transport.
```json
// Request
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search","arguments":{"query":"apple"}},"id":1}

// Response
{"jsonrpc":"2.0","result":{"content":[{"type":"text","text":"..."}]},"id":1}
```

**Tech:** Pure TypeScript. No CLI. Tool dispatch calls Supabase directly.

**Acceptance:** Claude Code / Hermes can connect via `{ "mcpServers": { "brainbase": { "url": "http://localhost:5174/api/mcp", "transport": "http" } } }` and run `search`, `get_page`, `get_health`.

---

### Feature 3: 3D Knowledge Graph (Three.js)

**What:** Three.js force-directed 3D graph rendered in the browser. Nodes = brain pages. Edges = brain links. Colors by page type. Size by link count.

**Data contract** (from `GET /api/brain/graph`):
```typescript
interface GraphData {
  nodes: {
    id: string        // slug
    label: string     // title
    type: string      // person | company | project | concept | idea
    linkCount: number // for sizing
    group: number     // community detection cluster
  }[]
  edges: {
    source: string    // node id
    target: string    // node id
    type: string      // friend | works_at | built | family | ...
  }[]
}
```

**Interaction:**
- Orbit, zoom, pan (standard Three.js controls)
- Click node → sidebar shows page content (title, type, links, timeline)
- Hover edge → tooltip shows link type
- Search bar highlights nodes + neighbors
- Dark theme (space background, emissive nodes)

**Tech:** Three.js + `three-forcegraph` or custom `THREE.BufferGeometry` with `d3-force-3d` for layout. No D3.js.

**Fallback:** If 3D performance is poor on mobile, render a 2D Three.js orthographic projection (same code, different camera). Not a separate D3 implementation.

**Acceptance:** Graph loads within 2 seconds for 671 pages. 60fps orbit. Click-to-inspect works. Mobile degrades gracefully to 30fps.

---

## 4. What We DO NOT Build

| Feature | Why Not |
|---------|---------|
| Multi-tenant / user accounts | Single brain (Preetham's). Auth already works via Clerk — keep it but don't expand. |
| Ingestion pipelines (GitHub, X, Calendar) | GBrain already has contacts + enrichment crons. Add later. |
| Page editor / CRUD UI | GBrain handles writes via agent. Web UI is read-only for v1. |
| Team workspaces | v2. |
| PGLite support | Dead on macOS 26.3. |
| D3.js graph | Replaced by Three.js. |
| Landing page / marketing site | Not needed for MVP. Dashboard is the homepage. |
| Settings page | Hardcode Preetham's config for now. |
| Onboarding flow | Single user. No onboarding needed. |
| Billing / pricing | Pre-revenue. Not yet. |

---

## 5. File Structure

```
brainbase/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (Clerk provider, dark theme)
│   │   ├── page.tsx                # → redirect to /dashboard
│   │   ├── dashboard/
│   │   │   └── page.tsx            # 3D graph + search + stats
│   │   ├── api/
│   │   │   ├── brain/
│   │   │   │   ├── health/route.ts
│   │   │   │   ├── search/route.ts
│   │   │   │   ├── graph/route.ts
│   │   │   │   └── page/[slug]/route.ts
│   │   │   └── mcp/route.ts        # MCP JSON-RPC server
│   │   └── llms.txt/route.ts       # Agent discovery
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Supabase server client
│   │   │   ├── pages.ts            # Page queries
│   │   │   ├── search.ts           # Hybrid search (pgvector)
│   │   │   ├── graph.ts            # Graph data queries
│   │   │   └── health.ts           # Brain stats
│   │   ├── mcp/
│   │   │   ├── server.ts           # MCP JSON-RPC dispatch
│   │   │   ├── tools.ts            # Tool definitions + implementations
│   │   │   └── types.ts            # MCP protocol types
│   │   └── types.ts                # Shared types
│   └── components/
│       ├── BrainGalaxy.tsx          # Three.js 3D graph (rename/rebuild from old)
│       ├── SearchBar.tsx            # Search input + results
│       ├── BrainStats.tsx           # Health dashboard cards
│       ├── PagePreview.tsx          # Slide-out page detail panel
│       └── MCPConnect.tsx           # Copy-paste MCP URL card
├── .env.local                       # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## 6. Development Stages

### Stage 1 — Supabase Direct Connect (1 hour)
**Goal:** Replace GBrain CLI with direct Supabase queries. All four API endpoints working.

- [ ] Create Supabase server client (`lib/supabase/client.ts`)
- [ ] Implement `lib/supabase/health.ts` → queries brain_stats
- [ ] Implement `lib/supabase/search.ts` → pgvector hybrid search
- [ ] Implement `lib/supabase/graph.ts` → real nodes + edges from brain_links
- [ ] Implement `lib/supabase/pages.ts` → page CRUD by slug
- [ ] Wire API routes: health, search, graph, page/:slug
- [ ] Test: all endpoints return real GBrain data in <500ms

**Acceptance:** `curl localhost:5174/api/brain/health` returns Preetham's brain stats.

### Stage 2 — MCP Server (1 hour)
**Goal:** Working MCP JSON-RPC server. Claude Code can connect and query.

- [ ] Implement MCP protocol types (`lib/mcp/types.ts`)
- [ ] Define tools (`lib/mcp/tools.ts`): search, get_page, query, get_links, get_backlinks, get_health, get_graph
- [ ] Implement dispatch (`lib/mcp/server.ts`): parse JSON-RPC, route to tool, return response
- [ ] Wire `POST /api/mcp` route
- [ ] Test with curl: `curl -X POST localhost:5174/api/mcp -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`
- [ ] Test with Hermes agent MCP config

**Acceptance:** Hermes can add Brainbase as an MCP server and query Preetham's brain.

### Stage 3 — Three.js 3D Graph (1.5 hours)
**Goal:** Replace D3CanvasGraph with Three.js 3D force graph. Real data, real edges.

- [ ] Install Three.js + force-graph dependencies
- [ ] Create `BrainGalaxy.tsx` (rewrite): Three.js scene, dark space background, emissive nodes
- [ ] Fetch graph data from `GET /api/brain/graph`
- [ ] Node rendering: sphere geometry, color by type, size by linkCount
- [ ] Edge rendering: line geometry, color by link_type
- [ ] Orbit controls: zoom, pan, rotate
- [ ] Click handler: select node → show PagePreview sidebar
- [ ] Hover handler: tooltip with link type
- [ ] Search integration: type in SearchBar → highlight matching nodes, dim others
- [ ] Mobile: render orthographic camera (same Three.js, just locked angle)
- [ ] Performance: 60fps for 671 nodes, degrades gracefully past 2000

**Acceptance:** Full 3D graph of Preetham's 671-page brain. Click a person → see their links. Search "apple" → Apple nodes light up.

### Stage 4 — Dashboard + Polish (45 min)
**Goal:** Clean single-page dashboard. Everything works together.

- [ ] Dashboard layout: BrainStats cards top, SearchBar, 3D graph (full height), PagePreview slide-out
- [ ] MCPConnect card: shows URL, copy button, tested-with badges
- [ ] Loading states: graph skeleton, stats skeleton
- [ ] Error states: "Could not connect to Supabase" with retry
- [ ] Empty state: "No brain data found. Run GBrain import first."
- [ ] Responsive: graph full-width on desktop, stacked on mobile
- [ ] Dark theme: consistent Tailwind dark mode

**Acceptance:** Visit `localhost:5174/dashboard`. See stats, 3D graph, search bar. Click around. Copy MCP URL. Done.

---

## 7. Success Metrics (MVP)

| Metric | Target |
|--------|--------|
| API response time (health) | <200ms |
| API response time (search) | <500ms |
| Graph load time (671 nodes) | <2s |
| Graph FPS (orbit) | 60fps desktop, 30fps mobile |
| MCP tool dispatch | <500ms |
| MCP tool count | 7 tools working |
| Build size (client JS) | <300KB gzipped |
| Time to working prototype | <4 hours with AI agent |

---

## 8. Key Decisions

1. **Supabase direct, not CLI wrapper.** The GBrain CLI is for local dev. Production uses Supabase SDK. We talk to the same tables GBrain uses.

2. **Three.js over D3.js.** Preetham explicitly prefers 3D. Three.js handles 2000+ nodes better than D3 at scale. Orthographic fallback for mobile, not a separate renderer.

3. **Read-only web UI.** The brain is written by agents (GBrain CLI, enrichment crons). The web UI displays it. Editing comes later.

4. **Single brain, not multi-tenant.** Preetham's brain on Preetham's Supabase. Auth is there (Clerk) but not the focus.

5. **No ingestion.** GBrain already handles contact import, enrichment, signal detection. Brainbase v1 displays what GBrain builds.

6. **Real graph edges.** No more synthetic link generation. Query `brain_links` table directly. The graph IS the data.

---

## 9. Open Questions

1. **Community detection?** For 671 nodes, a basic Louvain or label-propagation algorithm could color-cluster the graph (family cluster, Apple cluster, etc.). Worth the complexity for MVP? → **Defer. Color by type only for v1.**

2. **pgvector search?** GBrain uses it. Should the API use it directly? → **Yes.** `GET /api/brain/search` calls pgvector's `<->` operator with OpenAI embeddings. GBrain already generates embeddings.

3. **Timeline visualization?** GBrain has timeline entries. Show them in PagePreview but not as a separate view? → **Yes. PagePreview shows timeline. No separate timeline view.**

4. **llms.txt content?** What should agents see when they hit `/llms.txt`? → **Brain stats + available tools + MCP endpoint URL. Machine-readable. Auto-generated from brain health data.**
