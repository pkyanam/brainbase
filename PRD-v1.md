# Brainbase — MVP v1.0 PRD

> **Status:** Live (v0.4)  | **Timeline:** Shipped  | **Stack:** Next.js 16 + Supabase + Three.js + MCP  
> **Goal:** Agent-first personal knowledge brain. Web UI is a client, not the product.

---

## 0. What We Learned from v0.3

**What worked:**
- Supabase-backed knowledge graph with pgvector embeddings and dream cycle enrichment
- Clerk + GitHub OAuth (working auth)
- Signal detection + enrichment crons (autonomous pipeline)
- Agent persona using the brain via API

**What didn't:**
- **GBrain CLI shell wrapper is a bottleneck.** `execSync("gbrain get...")` spawns a subprocess per API call. 15s timeout. Not scalable.
- **D3.js 2D graph is wrong.** Three.js 3D is the right call. 2D can't show link density.
- **Fake graph links.** `getLinks()` generates synthetic edges by type-matching. Not real data.
- **PGLite is dead.** macOS 26.3 XProtect v5341 kills WASM. Supabase only.
- **No real MCP.** Routes proxy to CLI. Not a proper MCP server.
- **Web-app-first architecture.** Dashboard is the product. Should be agent-first.

**What changes:**
- Talk to Supabase directly. No GBrain CLI.
- Three.js 3D graph with real edges from links table.
- Proper MCP server with tool dispatch.
- Agent-first API surface. Web UI renders from the same APIs agents use.

---

## 1. Product Overview

### 1.1 One Breath
**Brainbase turns your knowledge graph into an agent-queryable 3D universe.**

### 1.2 What Changes from v0.3

| v0.3 (Current) | v1.0 (Target) |
|---|---|
| GBrain CLI subprocess per request | Direct Supabase queries |
| D3.js 2D force graph | Three.js 3D force graph |
| Fake synthetic edges | Real edges from links table |
| MCP routes proxy to CLI | Proper MCP tool dispatch |
| Web app with agent endpoints | Agent-first API + web client |
| PGLite (dead) + Supabase | Supabase only |
| Next.js 15 | Next.js 16 |

### 1.3 What v1.0 Is NOT
- Not an ingestion platform (no OAuth connectors initially)
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
│  Extensions: pgvector                             │
└───────────────────────────────────────────────────┘
```

---

## 3. What We Build (3 Features Only)

### Feature 1: Brain API (Direct Supabase)

**What:** Clean API that queries Supabase tables directly. No CLI subprocess. No fake data.

**Endpoints:**
```
GET /api/brain/health          → { page_count, link_count, brain_score, ... }
GET /api/brain/search?q=...    → [{ slug, title, type, score, excerpt }]
GET /api/brain/graph            → { nodes: [...], edges: [...] }
GET /api/brain/page/:slug      → { slug, title, type, content, frontmatter, links }
```

**Tech:** `@supabase/supabase-js` with service role key. Server-side only. No client-side DB access.

**Acceptance:** All four endpoints return real data within 500ms.

---

### Feature 2: MCP Server (Agent-First)

**What:** Real MCP JSON-RPC server at `POST /api/mcp`. Agents connect here. This is the PRIMARY product surface.

**Tools exposed:**
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

**Acceptance:** Claude Code / Hermes can connect via MCP config and run `search`, `get_page`, `get_health`.

---

### Feature 3: 3D Knowledge Graph (Three.js)

**What:** Three.js force-directed 3D graph rendered in the browser. Nodes = brain pages. Edges = brain links. Colors by page type. Size by link count.

**Interaction:**
- Orbit, zoom, pan (standard Three.js controls)
- Click node → sidebar shows page content (title, type, links, timeline)
- Hover edge → tooltip shows link type
- Search bar highlights nodes + neighbors
- Dark theme (space background, emissive nodes)

**Tech:** Three.js + custom BufferGeometry with force layout. No D3.js.

**Fallback:** Orthographic projection for mobile. Same Three.js code, different camera.

**Acceptance:** Graph loads within 2 seconds. 60fps orbit. Click-to-inspect works. Mobile degrades gracefully to 30fps.

---

## 4. What We DO NOT Build

| Feature | Why Not |
|---------|---------|
| Multi-tenant / user accounts | Auth exists (Clerk). Expand later. |
| Ingestion pipelines (GitHub, X, Calendar) | Add after core API is solid. |
| Page editor / CRUD UI | Brain is written by agents. Web UI is read-only for v1. |
| Team workspaces | v2. |
| PGLite support | Dead on macOS 26.3. |
| D3.js graph | Replaced by Three.js. |
| Landing page / marketing site | Dashboard is the homepage. |
| Onboarding flow | Add when multi-tenant ships. |
| Billing / pricing | Pre-revenue. |

---

## 5. Success Metrics (MVP)

| Metric | Target |
|--------|--------|
| API response time (health) | <200ms |
| API response time (search) | <500ms |
| Graph load time | <2s |
| Graph FPS (orbit) | 60fps desktop, 30fps mobile |
| MCP tool dispatch | <500ms |
| MCP tool count | 7 tools working |
| Build size (client JS) | <300KB gzipped |

---

## 6. Key Decisions

1. **Supabase direct, not CLI wrapper.** The GBrain CLI is for local dev. Production uses Supabase SDK. We talk to the same tables.

2. **Three.js over D3.js.** Three.js handles large graphs better at scale. Orthographic fallback for mobile, not a separate renderer.

3. **Read-only web UI.** The brain is written by agents (CLI, enrichment crons). The web UI displays it.

4. **Real graph edges.** No more synthetic link generation. Query the links table directly. The graph IS the data.

5. **No ingestion in v1.** GBrain already handles import, enrichment, signal detection. Brainbase displays what the brain builds.
