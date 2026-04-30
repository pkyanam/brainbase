     1|# Brainbase — MVP v1.0 PRD (Clean Slate)
     2|
     3|> **Status:** Live (v0.4)  | **Timeline:** Shipped  | **Stack:** Next.js 16 + Supabase + Three.js + MCP  
     4|> **Goal:** Agent-first personal knowledge brain. Web UI is a client, not the product.
     5|
     6|---
     7|
     8|## 0. What We Learned from v0.3
     9|
    10|**What worked:**
    11|- GBrain on Supabase (720 pages, 918 chunks, actively embedding (currently 37%, catching up via dream cycle))
    12|- Clerk + GitHub OAuth (working auth)
    13|- Signal detection + enrichment crons (autonomous pipeline)
    14|- Agent persona (Lara on Telegram) using the brain
    15|
    16|**What didn't:**
    17|- **GBrain CLI shell wrapper is a bottleneck.** `execSync("gbrain get...")` spawns a subprocess per API call. 15s timeout. Not scalable.
    18|- **D3.js 2D graph is wrong.** Preetham wants Three.js 3D. 2D can't show link density.
    19|- **Fake graph links.** `getLinks()` generates synthetic edges by type-matching. Not real data.
    20|- **PGLite is dead.** macOS 26.3 XProtect v5341 kills WASM. Supabase only.
    21|- **No real MCP.** Routes proxy to CLI. Not a proper MCP server.
    22|- **Web-app-first architecture.** Dashboard is the product. Should be agent-first.
    23|
    24|**What changes:**
    25|- Talk to Supabase directly. No GBrain CLI.
    26|- Three.js 3D graph with real edges from `brain_links` table.
    27|- Proper MCP server with tool dispatch.
    28|- Agent-first API surface. Web UI renders from the same APIs agents use.
    29|- Single brain (Preetham's). Multi-tenant later.
    30|
    31|---
    32|
    33|## 1. Product Overview
    34|
    35|### 1.1 One Breath
    36|**Brainbase turns your GBrain into an agent-queryable 3D knowledge universe.**
    37|
    38|### 1.2 What Changes from v0.3
    39|
    40|| v0.3 (Current) | v1.0 (Target) |
    41||---|---|
    42|| GBrain CLI subprocess per request | Direct Supabase queries |
    43|| D3.js 2D force graph | Three.js 3D force graph |
    44|| Fake synthetic edges | Real edges from brain_links |
    45|| MCP routes proxy to CLI | Proper MCP tool dispatch |
    46|| Web app with agent endpoints | Agent-first API + web client |
    47|| PGLite (dead) + Supabase | Supabase only |
    48|| Next.js 15 | Next.js 16 |
    49|
    50|### 1.3 What v1.0 Is NOT
    51|- Not multi-tenant (single brain — Preetham's)
    52|- Not an ingestion platform (no OAuth connectors)
    53|- Not a GBrain replacement (uses GBrain's Supabase schema)
    54|- Not a team/org tool
    55|- Not a no-code builder
    56|
    57|---
    58|
    59|## 2. Architecture
    60|
    61|```
    62|┌──────────────────────────────────────────────┐
    63|│                  CLIENTS                      │
    64|│                                               │
    65|│  Web UI (Three.js)   │   AI Agents (MCP)     │
    66|│  /dashboard          │   POST /mcp           │
    67|│                       │   curl /api/search    │
    68|└──────────┬───────────────┬────────────────────┘
    69|           │               │
    70|┌──────────▼───────────────▼────────────────────┐
    71|│           Next.js API Layer                     │
    72|│                                                 │
    73|│  GET  /api/brain/health     Brain stats         │
    74|│  GET  /api/brain/search?q=  Hybrid search       │
    75|│  GET  /api/brain/graph       Graph data (3D)    │
    76|│  GET  /api/brain/page/:slug Page content        │
    77|│  POST /api/mcp               MCP JSON-RPC       │
    78|│  GET  /llms.txt             Agent discovery     │
    79|└──────────────────┬──────────────────────────────┘
    80|                   │
    81|┌──────────────────▼──────────────────────────────┐
    82|│              Supabase (GBrain schema)             │
    83|│                                                    │
    84|│  Tables: pages, links, timeline, chunks, ...      │
    85|│  Extensions: pgvector, pg_graphql                 │
    86|└───────────────────────────────────────────────────┘
    87|```
    88|
    89|---
    90|
    91|## 3. What We Build (3 Features Only)
    92|
    93|### Feature 1: Brain API (Direct Supabase)
    94|
    95|**What:** Clean API that queries GBrain's Supabase tables directly. No CLI subprocess. No fake data.
    96|
    97|**Endpoints:**
    98|```
    99|GET /api/brain/health          → { page_count, link_count, brain_score, ... }
   100|GET /api/brain/search?q=...    → [{ slug, title, type, score, excerpt }]
   101|GET /api/brain/graph            → { nodes: [...], edges: [...] }
   102|GET /api/brain/page/:slug      → { slug, title, type, content, frontmatter, links }
   103|```
   104|
   105|**Data sources (GBrain Supabase tables):**
   106|- `brain_pages` → page CRUD
   107|- `brain_links` → real graph edges (not synthetic)
   108|- `content_chunks` → vector search via pgvector
   109|- `brain_stats` → health/score
   110|
   111|**Tech:** `@supabase/supabase-js` with service role key. Server-side only. No client-side DB access.
   112|
   113|**Acceptance:** All four endpoints return real data from Preetham's brain within 500ms.
   114|
   115|---
   116|
   117|### Feature 2: MCP Server (Agent-First)
   118|
   119|**What:** Real MCP JSON-RPC server at `POST /api/mcp`. Agents connect here. This is the PRIMARY product surface.
   120|
   121|**Tools exposed (from GBrain's 30+ tool set):**
   122|```
   123|search         — hybrid search (vector + keyword)
   124|get_page       — read a brain page
   125|query          — natural language query
   126|get_links      — outgoing links from a page
   127|get_backlinks  — incoming links to a page
   128|get_health     — brain stats dashboard
   129|get_graph      — full graph data for visualization
   130|```
   131|
   132|**Protocol:** JSON-RPC 2.0 over HTTP POST. Standard MCP transport.
   133|```json
   134|// Request
   135|{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search","arguments":{"query":"apple"}},"id":1}
   136|
   137|// Response
   138|{"jsonrpc":"2.0","result":{"content":[{"type":"text","text":"..."}]},"id":1}
   139|```
   140|
   141|**Tech:** Pure TypeScript. No CLI. Tool dispatch calls Supabase directly.
   142|
   143|**Acceptance:** Claude Code / Hermes can connect via `{ "mcpServers": { "brainbase": { "url": "http://localhost:5174/api/mcp", "transport": "http" } } }` and run `search`, `get_page`, `get_health`.
   144|
   145|---
   146|
   147|### Feature 3: 3D Knowledge Graph (Three.js)
   148|
   149|**What:** Three.js force-directed 3D graph rendered in the browser. Nodes = brain pages. Edges = brain links. Colors by page type. Size by link count.
   150|
   151|**Data contract** (from `GET /api/brain/graph`):
   152|```typescript
   153|interface GraphData {
   154|  nodes: {
   155|    id: string        // slug
   156|    label: string     // title
   157|    type: string      // person | company | project | concept | idea
   158|    linkCount: number // for sizing
   159|    group: number     // community detection cluster
   160|  }[]
   161|  edges: {
   162|    source: string    // node id
   163|    target: string    // node id
   164|    type: string      // friend | works_at | built | family | ...
   165|  }[]
   166|}
   167|```
   168|
   169|**Interaction:**
   170|- Orbit, zoom, pan (standard Three.js controls)
   171|- Click node → sidebar shows page content (title, type, links, timeline)
   172|- Hover edge → tooltip shows link type
   173|- Search bar highlights nodes + neighbors
   174|- Dark theme (space background, emissive nodes)
   175|
   176|**Tech:** Three.js + `three-forcegraph` or custom `THREE.BufferGeometry` with `d3-force-3d` for layout. No D3.js.
   177|
   178|**Fallback:** If 3D performance is poor on mobile, render a 2D Three.js orthographic projection (same code, different camera). Not a separate D3 implementation.
   179|
   180|**Acceptance:** Graph loads within 2 seconds for 720 pages. 60fps orbit. Click-to-inspect works. Mobile degrades gracefully to 30fps.
   181|
   182|---
   183|
   184|## 4. What We DO NOT Build
   185|
   186|| Feature | Why Not |
   187||---------|---------|
   188|| Multi-tenant / user accounts | Single brain (Preetham's). Auth already works via Clerk — keep it but don't expand. |
   189|| Ingestion pipelines (GitHub, X, Calendar) | GBrain already has contacts + enrichment crons. Add later. |
   190|| Page editor / CRUD UI | GBrain handles writes via agent. Web UI is read-only for v1. |
   191|| Team workspaces | v2. |
   192|| PGLite support | Dead on macOS 26.3. |
   193|| D3.js graph | Replaced by Three.js. |
   194|| Landing page / marketing site | Not needed for MVP. Dashboard is the homepage. |
   195|| Settings page | Hardcode Preetham's config for now. |
   196|| Onboarding flow | Single user. No onboarding needed. |
   197|| Billing / pricing | Pre-revenue. Not yet. |
   198|
   199|---
   200|
   201|## 5. File Structure
   202|
   203|```
   204|brainbase/
   205|├── src/
   206|│   ├── app/
   207|│   │   ├── layout.tsx              # Root layout (Clerk provider, dark theme)
   208|│   │   ├── page.tsx                # → redirect to /dashboard
   209|│   │   ├── dashboard/
   210|│   │   │   └── page.tsx            # 3D graph + search + stats
   211|│   │   ├── api/
   212|│   │   │   ├── brain/
   213|│   │   │   │   ├── health/route.ts
   214|│   │   │   │   ├── search/route.ts
   215|│   │   │   │   ├── graph/route.ts
   216|│   │   │   │   └── page/[slug]/route.ts
   217|│   │   │   └── mcp/route.ts        # MCP JSON-RPC server
   218|│   │   └── llms.txt/route.ts       # Agent discovery
   219|│   ├── lib/
   220|│   │   ├── supabase/
   221|│   │   │   ├── client.ts           # Supabase server client
   222|│   │   │   ├── pages.ts            # Page queries
   223|│   │   │   ├── search.ts           # Hybrid search (pgvector)
   224|│   │   │   ├── graph.ts            # Graph data queries
   225|│   │   │   └── health.ts           # Brain stats
   226|│   │   ├── mcp/
   227|│   │   │   ├── server.ts           # MCP JSON-RPC dispatch
   228|│   │   │   ├── tools.ts            # Tool definitions + implementations
   229|│   │   │   └── types.ts            # MCP protocol types
   230|│   │   └── types.ts                # Shared types
   231|│   └── components/
   232|│       ├── BrainGalaxy.tsx          # Three.js 3D graph (rename/rebuild from old)
   233|│       ├── SearchBar.tsx            # Search input + results
   234|│       ├── BrainStats.tsx           # Health dashboard cards
   235|│       ├── PagePreview.tsx          # Slide-out page detail panel
   236|│       └── MCPConnect.tsx           # Copy-paste MCP URL card
   237|├── .env.local                       # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.
   238|├── next.config.ts
   239|├── package.json
   240|└── tsconfig.json
   241|```
   242|
   243|---
   244|
   245|## 6. Development Stages
   246|
   247|### Stage 1 — Supabase Direct Connect (1 hour)
   248|**Goal:** Replace GBrain CLI with direct Supabase queries. All four API endpoints working.
   249|
   250|- [x] Create Supabase server client (`lib/supabase/client.ts`)
   251|- [x] Implement `lib/supabase/health.ts` → queries brain_stats
   252|- [x] Implement `lib/supabase/search.ts` → pgvector hybrid search
   253|- [x] Implement `lib/supabase/graph.ts` → real nodes + edges from brain_links
   254|- [x] Implement `lib/supabase/pages.ts` → page CRUD by slug
   255|- [x] Wire API routes: health, search, graph, page/:slug
   256|- [x] Test: all endpoints return real GBrain data in <500ms
   257|
   258|**Acceptance:** `curl localhost:5174/api/brain/health` returns Preetham's brain stats.
   259|
   260|### Stage 2 — MCP Server (1 hour)
   261|**Goal:** Working MCP JSON-RPC server. Claude Code can connect and query.
   262|
   263|- [x] Implement MCP protocol types (`lib/mcp/types.ts`)
   264|- [x] Define tools (`lib/mcp/tools.ts`): search, get_page, query, get_links, get_backlinks, get_health, get_graph
   265|- [x] Implement dispatch (`lib/mcp/server.ts`): parse JSON-RPC, route to tool, return response
   266|- [x] Wire `POST /api/mcp` route
   267|- [x] Test with curl: `curl -X POST localhost:5174/api/mcp -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`
   268|- [x] Test with Hermes agent MCP config
   269|
   270|**Acceptance:** Hermes can add Brainbase as an MCP server and query Preetham's brain.
   271|
   272|### Stage 3 — Three.js 3D Graph (1.5 hours)
   273|**Goal:** Replace D3CanvasGraph with Three.js 3D force graph. Real data, real edges.
   274|
   275|- [x] Install Three.js + force-graph dependencies
   276|- [x] Create `BrainGalaxy.tsx` (rewrite): Three.js scene, dark space background, emissive nodes
   277|- [x] Fetch graph data from `GET /api/brain/graph`
   278|- [x] Node rendering: sphere geometry, color by type, size by linkCount
   279|- [x] Edge rendering: line geometry, color by link_type
   280|- [x] Orbit controls: zoom, pan, rotate
   281|- [x] Click handler: select node → show PagePreview sidebar
   282|- [x] Hover handler: tooltip with link type
   283|- [x] Search integration: type in SearchBar → highlight matching nodes, dim others
   284|- [x] Mobile: render orthographic camera (same Three.js, just locked angle)
   285|- [x] Performance: 60fps for 720 nodes, degrades gracefully past 2000
   286|
   287|**Acceptance:** Full 3D graph of Preetham's 720-page brain. Click a person → see their links. Search "apple" → Apple nodes light up.
   288|
   289|### Stage 4 — Dashboard + Polish (45 min)
   290|**Goal:** Clean single-page dashboard. Everything works together.
   291|
   292|- [x] Dashboard layout: BrainStats cards top, SearchBar, 3D graph (full height), PagePreview slide-out
   293|- [x] MCPConnect card: shows URL, copy button, tested-with badges
   294|- [x] Loading states: graph skeleton, stats skeleton
   295|- [x] Error states: "Could not connect to Supabase" with retry
   296|- [x] Empty state: "No brain data found. Run GBrain import first."
   297|- [x] Responsive: graph full-width on desktop, stacked on mobile
   298|- [x] Dark theme: consistent Tailwind dark mode
   299|
   300|**Acceptance:** Visit `localhost:5174/dashboard`. See stats, 3D graph, search bar. Click around. Copy MCP URL. Done.
   301|
   302|---
   303|
   304|## 7. Success Metrics (MVP)
   305|
   306|| Metric | Target |
   307||--------|--------|
   308|| API response time (health) | <200ms |
   309|| API response time (search) | <500ms |
   310|| Graph load time (720 nodes) | <2s |
   311|| Graph FPS (orbit) | 60fps desktop, 30fps mobile |
   312|| MCP tool dispatch | <500ms |
   313|| MCP tool count | 7 tools working |
   314|| Build size (client JS) | <300KB gzipped |
   315|| Time to working prototype | <4 hours with AI agent |
   316|
   317|---
   318|
   319|## 8. Key Decisions
   320|
   321|1. **Supabase direct, not CLI wrapper.** The GBrain CLI is for local dev. Production uses Supabase SDK. We talk to the same tables GBrain uses.
   322|
   323|2. **Three.js over D3.js.** Preetham explicitly prefers 3D. Three.js handles 2000+ nodes better than D3 at scale. Orthographic fallback for mobile, not a separate renderer.
   324|
   325|3. **Read-only web UI.** The brain is written by agents (GBrain CLI, enrichment crons). The web UI displays it. Editing comes later.
   326|
   327|4. **Single brain, not multi-tenant.** Preetham's brain on Preetham's Supabase. Auth is there (Clerk) but not the focus.
   328|
   329|5. **No ingestion.** GBrain already handles contact import, enrichment, signal detection. Brainbase v1 displays what GBrain builds.
   330|
   331|6. **Real graph edges.** No more synthetic link generation. Query `brain_links` table directly. The graph IS the data.
   332|
   333|---
   334|
   335|## 9. Open Questions
   336|
   337|1. **Community detection?** For 720 nodes, a basic Louvain or label-propagation algorithm could color-cluster the graph (family cluster, Apple cluster, etc.). Worth the complexity for MVP? → **Defer. Color by type only for v1.**
   338|
   339|2. **pgvector search?** GBrain uses it. Should the API use it directly? → **Yes.** `GET /api/brain/search` calls pgvector's `<->` operator with OpenAI embeddings. GBrain already generates embeddings.
   340|
   341|3. **Timeline visualization?** GBrain has timeline entries. Show them in PagePreview but not as a separate view? → **Yes. PagePreview shows timeline. No separate timeline view.**
   342|
   343|4. **llms.txt content?** What should agents see when they hit `/llms.txt`? → **Brain stats + available tools + MCP endpoint URL. Machine-readable. Auto-generated from brain health data.**
   344|