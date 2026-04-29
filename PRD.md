# Brainbase — Product Requirements Document

> **Status:** MVP v0.2 — functional prototype, multi-tenant ready  
> **Timeline:** 1–2 days with AI coding agents (Claude Code, Codex, Cursor)  
> **Stack:** Next.js 15 (App Router) + Tailwind v4 + TypeScript + PGLite + D3.js  
> **Goal:** Working prototype — single-user brain with GitHub + X + Calendar ingestion, knowledge graph visualization, agent endpoint.

---

## 1. Product Overview

### 1.1 What It Is
A web application that turns your scattered digital life (GitHub repos, X posts, calendar events) into an AI agent-usable knowledge brain. Three clicks from signup to having a persistent memory your AI agents can query.

### 1.2 What It Is NOT
- Not a GBrain competitor (uses GBrain engine under the hood)
- Not a team/org tool (single-user v1)
- Not an AI chat interface (agents handle that — we're the backend)
- Not a no-code platform (we handle ingestion; agents handle usage)

### 1.3 Core Differentiator
GBrain exists and works. The problem is **onboarding friction.** Brainbase compresses a 30-minute CLI setup into 3 OAuth clicks. Same engine. Zero-config brain.

---

## 2. User Journey (Happy Path)

```
1. Land on brainbase.app
2. Click "Create Brain" → GitHub OAuth
3. Watch ingestion progress: "Found 23 repos, 14 people, 2 orgs..."
4. Connect X → OAuth → tweets ingested
5. Connect Calendar → OAuth → meetings + attendees extracted
6. Brain dashboard appears with knowledge graph visualization
7. Copy MCP endpoint URL
8. Paste into Claude Code / Cursor / Hermes
9. Agent now has persistent memory
```

Time to value: < 3 minutes from landing to agent-ready brain.

---

## 3. Technical Architecture

### 3.1 System Diagram
```
┌─────────────────────────────────────────────────┐
│  Next.js Frontend (Vercel)                       │
│  - Landing page                                  │
│  - OAuth flow (GitHub, X, Calendar)              │
│  - Dashboard (graph viz, stats, search)          │
│  - Settings                                      │
└──────────────────┬──────────────────────────────┘
                   │ API calls
┌──────────────────▼──────────────────────────────┐
│  Next.js API Routes / Backend (Railway/Render)   │
│  - Auth (Clerk)                                  │
│  - Ingestion pipeline (GitHub, X, Calendar)      │
│  - GBrain engine wrapper                         │
│  - MCP server endpoint                           │
│  - Search API                                    │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│  PGLite (per-user) or Supabase                  │
│  - Brain pages (markdown)                       │
│  - Entity index (people, companies, projects)    │
│  - Knowledge graph edges                        │
│  - Timeline entries                              │
│  - Embeddings vector store                       │
└─────────────────────────────────────────────────┘
```

### 3.2 Technology Choices
| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 15 (App Router) | Server components, API routes, Vercel-native |
| Styling | Tailwind v4 | Fast, utility-first, dark theme built-in |
| Language | TypeScript strict | Safety for AI-generated code |
| Visualization | D3.js force-graph | Knowledge graph rendering |
| Auth | Clerk | Drop-in OAuth for GitHub, Google |
| Backend | Next.js API routes | Keep it simple — no separate server |
| Brain engine | GBrain (existing) | Battle-tested, 17K-page production brain |
| Database | PGLite (dev) / Supabase (prod) | Zero-config local, scalable remote |
| Hosting | Vercel | Free tier, auto-deploy, Edge Functions |
| Agent surface | MCP over HTTP | Any agent can connect via URL |

### 3.3 API Surface (Agent-First)
Every brain exposes:
```
GET  /b/{username}/llms.txt          → Brain map for LLMs
GET  /b/{username}/api/status.json   → Brain stats, capabilities
GET  /b/{username}/api/search?q=...  → Hybrid search with citations
POST /b/{username}/mcp               → MCP server (30+ tools)
```

---

## 4. Database Schema

### 4.1 Brain Page (mirrors GBrain page structure)
```sql
CREATE TABLE brain_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('person','company','project','concept','idea','source','meeting')),
  content TEXT NOT NULL, -- markdown
  frontmatter JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, slug)
);
```

### 4.2 Knowledge Graph Edges
```sql
CREATE TABLE brain_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  from_slug TEXT NOT NULL,
  to_slug TEXT NOT NULL,
  link_type TEXT NOT NULL, -- 'built', 'works_at', 'invested_in', 'founded', 'attended', 'references'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.3 Timeline Entries
```sql
CREATE TABLE brain_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  page_slug TEXT NOT NULL,
  date DATE NOT NULL,
  summary TEXT NOT NULL,
  detail TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.4 Ingestion Log
```sql
CREATE TABLE ingestion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  source_type TEXT NOT NULL, -- 'github', 'x', 'calendar', 'manual'
  source_ref TEXT NOT NULL,
  pages_created INTEGER DEFAULT 0,
  pages_updated INTEGER DEFAULT 0,
  links_created INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Development Stages

### Stage 0 — Project Scaffold (20 min)
**Goal:** Working Next.js app with auth, database, and dark theme.

#### Tasks:
- [ ] `npx create-next-app@latest brainbase --typescript --tailwind --app`
- [ ] Install deps: `@clerk/nextjs`, `@electric-sql/pglite`, `d3`, `zod`, `react-hot-toast`
- [ ] Configure Clerk for GitHub OAuth
- [ ] Set up PGLite singleton
- [ ] Apply dark theme (Tailwind config + global CSS vars)
- [ ] Create layout with nav placeholder
- [ ] Create landing page at `/`

**Acceptance criteria:**
- App deploys to Vercel
- User can sign in with GitHub
- Dark theme renders correctly
- Database initializes

---

### Stage 1 — Brain Engine Integration (45 min)
**Goal:** GBrain engine wrapped in API routes. Can create pages, query, search.

#### Tasks:
- [ ] Copy GBrain core logic into `lib/gbrain/` (page CRUD, link extraction, search)
- [ ] Create API route: `POST /api/brain/pages` — create/update page
- [ ] Create API route: `GET /api/brain/pages?slug=X` — read page
- [ ] Create API route: `GET /api/brain/search?q=X` — hybrid search
- [ ] Create API route: `GET /api/brain/health` — stats
- [ ] Implement deterministic entity extraction (regex-based, zero LLM calls)
- [ ] Implement typed link auto-creation on page write
- [ ] Write unit tests for page CRUD and link extraction

**Acceptance criteria:**
- Can create, read, search brain pages via API
- Entity extraction creates typed links automatically
- Search returns scored results with citations
- All tests pass

---

### Stage 2 — GitHub Ingestion Pipeline (1 hour)
**Goal:** User connects GitHub → repos, people, orgs ingested into brain.

#### Tasks:
- [ ] Create OAuth flow for GitHub (Clerk handles this)
- [ ] Store GitHub access token encrypted in user profile
- [ ] Create ingestion service: `lib/ingestion/github.ts`
  - Fetch user's repos via GitHub API
  - For each repo: create project page with README, language, stars, topics
  - Extract unique contributors as person pages
  - Extract orgs as company pages
  - Create `built` links: user → repo
  - Create `works_at` links: contributors → orgs
- [ ] Create API route: `POST /api/ingest/github`
- [ ] Show ingestion progress via Server-Sent Events or polling
- [ ] Create frontend component: `GitHubIngestCard` (connect button + progress)
- [ ] Handle rate limits gracefully (show warning, continue with partial data)

**Data to extract per repo:**
```
project page: name, description, language, stars, topics, README excerpt
person pages: contributors (login, avatar, contributions count)
company pages: organization owners
links: user-[built]->repo, contributor-[contributed_to]->repo, user-[works_at]->org
```

**Acceptance criteria:**
- User clicks "Connect GitHub" → repos ingested within 30 seconds
- Each repo creates a project page with accurate metadata
- Contributors create person pages with typed links
- Progress bar visible during ingestion

---

### Stage 3 — X/Twitter Ingestion Pipeline (30 min)
**Goal:** User connects X → tweets ingested as idea pages.

#### Tasks:
- [ ] Create OAuth flow for X (use xurl or direct API)
- [ ] Store X access token encrypted
- [ ] Create ingestion service: `lib/ingestion/x.ts`
  - Fetch user profile
  - Fetch recent 200 tweets
  - For each tweet: create idea page if original (not RT/reply without context)
  - Extract mentioned handles as person stubs
  - Extract URLs as source references
  - Create `posted` links: user → idea
  - Tag ideas by detected topics (regex-based)
- [ ] Create API route: `POST /api/ingest/x`
- [ ] Create frontend component: `XIngestCard`

**Data to extract per tweet:**
```
idea page: content (tweet text), date, source URL, detected entities
person stubs: @mentions found in tweets
links: user-[posted]->idea, idea-[mentions]->person
```

**Acceptance criteria:**
- User clicks "Connect X" → recent tweets ingested
- Original tweets create idea pages with timestamps
- @mentions create person stubs
- Non-original tweets (RTs) filtered out

---

### Stage 4 — Calendar Ingestion Pipeline (30 min)
**Goal:** User connects Google Calendar → meetings + attendees ingested.

#### Tasks:
- [ ] Create OAuth flow for Google Calendar
- [ ] Store Google access token encrypted
- [ ] Create ingestion service: `lib/ingestion/calendar.ts`
  - Fetch next 30 days of events
  - For each event: create meeting page with title, date, attendees, description
  - Create/update person pages for attendees
  - Create `attended` links: person → meeting
  - Add timeline entries to person pages
- [ ] Create API route: `POST /api/ingest/calendar`
- [ ] Create frontend component: `CalendarIngestCard`

**Acceptance criteria:**
- User clicks "Connect Calendar" → upcoming meetings ingested
- Each meeting creates a page with attendees linked
- Attendee pages created/updated with timeline entries

---

### Stage 5 — Dashboard + Knowledge Graph (1 hour)
**Goal:** Beautiful dashboard showing the brain as a navigable graph.

#### Tasks:
- [ ] Create dashboard page at `/dashboard`
- [ ] Brain stats component:
  - Page count by type
  - People count, company count, project count
  - Recent activity feed (last 10 ingestion events)
- [ ] Knowledge graph visualization using D3.js force simulation:
  - Nodes colored by type (person=purple, company=cyan, project=green, concept=amber)
  - Node size proportional to link count
  - Edges labeled by link type (small text on hover)
  - Click node → show page preview in sidebar
  - Zoom + pan support
  - Query filter (type a name → highlight node + neighbors)
- [ ] Search bar: "Ask your brain anything..." → query results with citations
- [ ] "Recent Activity" feed component
- [ ] Empty states for each component

**Graph data contract:**
```typescript
interface GraphData {
  nodes: { id: string; slug: string; type: string; label: string; linkCount: number }[]
  edges: { source: string; target: string; type: string }[]
}
```

**Acceptance criteria:**
- Dashboard loads with stats after ingestion
- Knowledge graph renders all pages as connected nodes
- Clicking a node shows page content in sidebar
- Search bar returns results from brain pages
- Empty state shows "Connect a source to build your brain"

---

### Stage 6 — Agent Endpoint (30 min)
**Goal:** Every brain exposes an MCP endpoint + agent-readable surfaces.

#### Tasks:
- [ ] Create API route: `GET /b/{username}/llms.txt`
- [ ] Create API route: `GET /b/{username}/api/status.json`
- [ ] Create API route: `GET /b/{username}/api/search?q=X`
- [ ] Create MCP server at `POST /b/{username}/mcp`
  - List tools: `search`, `get_page`, `query`, `get_links`, `get_backlinks`, `get_health`, `get_stats`
  - Implement tool dispatch
  - Return JSON-RPC responses
- [ ] Create frontend: "Connect to your agent" card with copy-paste URL
- [ ] Add quick-start instructions for Claude Code, Cursor, Hermes

**Agent endpoint response (llms.txt):**
```
# Brainbase — Preetham's Brain
# https://brainbase.app/b/preetham

## About
247 pages, 89 people, 14 companies, 53 projects. Connected knowledge graph with typed links.

## Agent Endpoints
- /b/preetham/api/status.json — brain stats
- /b/preetham/api/search?q=... — hybrid search with citations
- /b/preetham/mcp — full MCP server (30+ tools)

## Connect
Add to your agent's MCP config:
{
  "mcpServers": {
    "brainbase": {
      "url": "https://brainbase.app/b/preetham/mcp",
      "transport": "http"
    }
  }
}
```

**Acceptance criteria:**
- `llms.txt` loads and describes the brain
- `status.json` returns accurate stats
- Search endpoint returns cited results
- MCP tools work: search, get_page, query, get_health
- Copy-paste card shows correct URL for user's brain

---

### Stage 7 — Polish + Launch Readiness (45 min)
**Goal:** Make it feel like a product, not a prototype.

#### Tasks:
- [ ] Landing page:
  - Hero: "Give your AI agents a memory"
  - Three-column features: Connect → Ingest → Query
  - "Build your brain" CTA
- [ ] Onboarding flow: step-by-step source connection
- [ ] Loading states for all ingestion steps
- [ ] Error states with human-readable messages
- [ ] Toast notifications (react-hot-toast)
- [ ] Mobile-responsive dashboard
- [ ] Favicon + OG image
- [ ] Meta tags for social sharing
- [ ] robots.txt + sitemap.xml
- [ ] `/llms.txt` for the brainbase site itself

**Acceptance criteria:**
- Landing page communicates value in < 10 seconds
- Onboarding connects all three sources without errors
- Mobile layout doesn't break
- Social sharing cards render correctly

---

## 6. Component Tree

```
App
├── Layout
│   ├── Nav (logo, user menu, sign out)
│   └── ToastContainer
├── Landing Page (/)
│   ├── Hero
│   ├── Features (3 cards)
│   └── CTA Button
├── Dashboard (/dashboard) — protected
│   ├── BrainStats (page counts by type)
│   ├── SourceConnectors
│   │   ├── GitHubIngestCard
│   │   ├── XIngestCard
│   │   └── CalendarIngestCard
│   ├── KnowledgeGraph (D3 force graph)
│   │   └── PagePreviewSidebar
│   ├── SearchBar
│   ├── SearchResults
│   └── RecentActivityFeed
├── Brain Page (/brain/[slug])
│   ├── PageHeader (title, type, updated)
│   ├── PageContent (markdown rendered)
│   ├── LinkList (outgoing typed links)
│   ├── BacklinkList (incoming links)
│   └── TimelineEntries
└── Settings (/settings)
    ├── ConnectedSources (status, reconnect, disconnect)
    ├── AgentEndpoint (copy URL)
    └── DangerZone (delete brain)
```

---

## 7. File Structure

```
brainbase/
├── app/
│   ├── layout.tsx              # Root layout + Clerk + theme
│   ├── page.tsx                # Landing page
│   ├── dashboard/
│   │   └── page.tsx            # Main dashboard (protected)
│   ├── brain/
│   │   └── [slug]/
│   │       └── page.tsx        # Individual brain page
│   ├── settings/
│   │   └── page.tsx            # User settings
│   ├── api/
│   │   ├── brain/
│   │   │   ├── pages/route.ts  # CRUD brain pages
│   │   │   ├── search/route.ts # Search endpoint
│   │   │   └── health/route.ts # Brain stats
│   │   ├── ingest/
│   │   │   ├── github/route.ts
│   │   │   ├── x/route.ts
│   │   │   └── calendar/route.ts
│   │   └── mcp/route.ts        # MCP server
│   └── b/
│       └── [username]/
│           ├── llms.txt/route.ts
│           ├── api/
│           │   ├── status/route.ts
│           │   └── search/route.ts
│           └── mcp/route.ts
├── components/
│   ├── ui/                     # Reusable: Button, Card, Input, Badge, Toast
│   ├── brain/
│   │   ├── KnowledgeGraph.tsx
│   │   ├── BrainStats.tsx
│   │   ├── SearchBar.tsx
│   │   ├── SearchResults.tsx
│   │   ├── PagePreview.tsx
│   │   ├── RecentActivity.tsx
│   │   └── AgentEndpoint.tsx
│   ├── ingestion/
│   │   ├── SourceConnector.tsx
│   │   ├── GitHubIngestCard.tsx
│   │   ├── XIngestCard.tsx
│   │   └── CalendarIngestCard.tsx
│   └── layout/
│       ├── Nav.tsx
│       └── Footer.tsx
├── lib/
│   ├── gbrain/
│   │   ├── engine.ts           # Page CRUD
│   │   ├── search.ts           # Hybrid search (keyword + vector)
│   │   ├── links.ts            # Typed link extraction
│   │   ├── entities.ts         # Entity detection (regex)
│   │   └── types.ts            # Shared types
│   ├── ingestion/
│   │   ├── github.ts
│   │   ├── x.ts
│   │   └── calendar.ts
│   ├── db.ts                   # PGLite / Supabase client
│   ├── auth.ts                 # Clerk helpers
│   └── utils.ts
├── types/
│   └── index.ts                # Global TypeScript types
├── public/
│   ├── llms.txt
│   ├── robots.txt
│   └── og-image.png
├── tailwind.config.ts
├── middleware.ts                # Clerk auth middleware
└── .env.example
```

---

## 8. API Contracts

### 8.1 Create/Update Brain Page
```
POST /api/brain/pages
Body: {
  slug: "people/sarah-chen",
  title: "Sarah Chen",
  type: "person",
  content: "# Sarah Chen\n\n...",
  frontmatter: { status: "active", tags: ["engineer", "startup"] }
}
Response: { slug: "people/sarah-chen", status: "created", links_created: 2 }
```

### 8.2 Search
```
GET /api/brain/search?q=pricing+model&limit=10
Response: {
  results: [{
    slug: "ideas/pricing-model-thoughts",
    title: "Pricing Model Thoughts",
    score: 0.89,
    excerpt: "...value-based pricing over...",
    links: ["projects/pkstack", "people/preetham-kyanam"]
  }],
  total: 3
}
```

### 8.3 Brain Health
```
GET /api/brain/health
Response: {
  page_count: 247,
  pages_by_type: { person: 89, project: 53, company: 14, concept: 45, idea: 32, source: 9, meeting: 5 },
  link_count: 312,
  brain_score: 68,
  orphans: 12
}
```

### 8.4 GitHub Ingestion
```
POST /api/ingest/github
Response: {
  repos_processed: 23,
  pages_created: 37,
  pages_updated: 12,
  links_created: 48,
  duration_seconds: 18
}
```

---

## 9. State Management

Keep it simple — no Redux, no Zustand. React Server Components + SWR for client-side data.

```typescript
// All data fetching uses SWR with revalidation
import useSWR from 'swr'

function useBrainHealth() {
  return useSWR('/api/brain/health', fetcher, { refreshInterval: 30000 })
}

function useGraphData() {
  return useSWR('/api/brain/graph', fetcher)
}

function useSearch(query: string) {
  return useSWR(query ? `/api/brain/search?q=${query}` : null, fetcher)
}
```

---

## 10. Error Handling Strategy

### Graceful degradation:
- **Ingestion partial failure:** Show "X of Y repos processed. 2 skipped (rate limited)."
- **Auth expired:** Show "Reconnect" button, don't crash
- **Database error:** Show toast "Brain is taking a nap. Try again."
- **Empty brain:** Show onboarding CTA, not a blank page

### User-facing errors (never show raw stack traces):
```
✅ "Connected! Processing your 23 GitHub repos..."
⚠️ "17 repos processed. 6 skipped — GitHub rate limit. They'll sync later."
❌ "Couldn't reach GitHub. Check your connection and try again."
```

---

## 11. Testing Strategy

### Unit tests (vitest):
- Brain engine CRUD operations
- Entity extraction regex accuracy
- Link creation logic
- Search ranking

### Integration tests:
- GitHub ingestion pipeline (mock API responses)
- Full ingestion → visualization flow

### Manual QA checklist:
- [ ] Sign up with GitHub
- [ ] Connect all three sources
- [ ] Verify graph renders with correct node counts
- [ ] Search returns relevant results
- [ ] Agent endpoint returns valid MCP responses
- [ ] Mobile layout doesn't break
- [ ] Dark theme renders all components legibly

---

## 12. What NOT to Build (Anti-Feature Creep)

| Don't Build | Why | Build Later When |
|-------------|-----|------------------|
| Team/org support | Adds auth complexity, billing, permissions | 10+ paying users |
| Custom enrichment rules | Garry's enrich skill handles this | Users request specific pipelines |
| AI chat interface | Agents do this — you're the backend | Never — it's not the product |
| White-label/embed | Premature abstraction | Enterprise customers |
| Mobile app | Responsive web works for v1 | User research shows demand |
| Billing/pricing | Free beta to validate | 50+ active users |
| Slack/Discord/Notion ingestion | More connectors = more maintenance | Top 3 user requests |
| Skill marketplace | Need critical mass first | 100+ brains active |
| Export/backup | Not blocking for prototype | User requests |

---

## 13. Deployment

### Vercel (recommended):
```bash
# Connect GitHub repo to Vercel
# Set environment variables:
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
DATABASE_URL=postgres://...  # Supabase (prod) or PGLite (dev)
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
# Deploy: git push main
```

### Database:
- **Development:** PGLite (embedded, zero-config)
- **Production:** Supabase (Postgres + pgvector for embeddings)

---

## 14. Success Metrics (Post-Launch)

| Metric | Target (Week 1) | Target (Month 1) |
|--------|-----------------|-------------------|
| Signups | 20 | 100 |
| Completed onboarding (3 sources) | 10 | 40 |
| Agent endpoint activations | 5 | 25 |
| Pages created per brain (avg) | 50 | 200 |
| Return rate (day 7) | 30% | 50% |

---

## 15. Open Questions

1. **Embedding provider:** OpenAI is $0.00002/1K tokens but we have $4.80 budget. Alternatives: local embedding model, or skip embeddings for MVP (keyword search works fine for < 1000 pages).
2. **X API access:** Requires Pay Per Use plan ($10 minimum). Alternative: manual X archive upload until paid.
3. **Domain:** brainbase.app? brainbase.dev? Other?
4. **Open source:** MIT license from day one? Or source-available with hosted option?

---

*Built for AI coding agents to execute. Each stage is self-contained with clear acceptance criteria. Start at Stage 0, don't proceed until tests pass.*
