# Brainbase — Multi-Tenant Architecture (v0.3+)

## Vision
Brainbase.app is a cloud-native platform where anyone signs up, connects their data sources via OAuth, and gets a personal knowledge brain their AI agents can query via MCP. No CLI. No config files. No local dependencies.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Brainbase.app                         │
│                                                          │
│  ┌─────────┐   ┌──────────┐   ┌────────────────────┐   │
│  │  Auth    │   │  Dashboard │   │  Agent Endpoints  │   │
│  │ (Clerk)  │   │  (Next.js) │   │  (MCP / llms.txt) │   │
│  └────┬─────┘   └─────┬─────┘   └─────────┬──────────┘   │
│       │               │                   │               │
│       └───────┬───────┴───────────────────┘               │
│               │                                           │
│       ┌───────▼────────┐                                  │
│       │   API Gateway   │  ← user-scoped, rate-limited    │
│       │  (Next.js API)  │                                  │
│       └───────┬────────┘                                  │
│               │                                           │
│   ┌───────────┼───────────┐                               │
│   │           │           │                               │
│   ▼           ▼           ▼                               │
│ ┌─────┐  ┌──────┐  ┌──────────┐                          │
│ │GitHub│  │  X   │  │ Calendar │  ← OAuth integrations    │
│ │Ingest│  │Ingest│  │ Ingest   │                          │
│ └──┬──┘  └──┬───┘  └────┬─────┘                          │
│    │        │            │                                 │
│    └────────┼────────────┘                                 │
│             │                                              │
│     ┌───────▼────────┐                                    │
│     │  Brain Engine   │  ← per-user GBrain instance       │
│     │  (Supabase PG)  │     or namespace                  │
│     └───────┬────────┘                                    │
│             │                                              │
│     ┌───────▼────────┐                                    │
│     │   Supabase      │  ← Postgres + pgvector            │
│     │   (DB + Auth)   │     per-user tables or RLS        │
│     └────────────────┘                                    │
└──────────────────────────────────────────────────────────┘
```

## Multi-Tenant Strategy

### Phase 1: Prototype (Current — v0.2)
- Single Supabase project with all pages
- Pages namespaced by username: `{username}/people/...`, `{username}/projects/...`
- Auth: no real auth (dev-only)
- Ingestion: local gh CLI for prototype

### Phase 2: Production MVP (v0.3 — target)
- Clerk auth (GitHub OAuth)
- Per-user Supabase schemas via Row-Level Security (RLS)
- Pages table has `user_id` column → RLS enforces `user_id = auth.uid()`
- Each user's brain is isolated at the database level
- Ingestion: GitHub OAuth tokens stored per-user (encrypted)

### Phase 3: Scale (v1.0)
- Per-user Supabase projects for heavy users
- Dedicated GBrain instances per user (optional, for power users)
- Cross-brain linking (shared entities like "OpenAI", "YC")
- Usage-based billing

## Data Isolation

### Option A: RLS (Recommended for MVP)
```sql
-- pages table has user_id column
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own pages"
  ON pages FOR ALL
  USING (user_id = auth.uid());
```

**Pros:** Single database, simple queries, built-in Supabase support
**Cons:** No per-user schema isolation, all users share DB resources

### Option B: Namespace Prefix (Current Prototype)
```
preetham/people/preetham-kyanam
alice/people/alice
bob/projects/startup-idea
```

**Pros:** Ultra-simple, works with GBrain CLI directly
**Cons:** No real security, relies on URL path filtering

### Option C: Per-User Supabase Projects (Scale)
- Each user gets their own Supabase project
- Brainbase manages project provisioning via Supabase Management API
- GBrain connects to user's dedicated database

**Pros:** Full isolation, no noisy neighbors, scales independently
**Cons:** Complex provisioning, higher cost

## Routing Convention

```
/b/{username}              → User's brain homepage
/b/{username}/dashboard    → User's brain dashboard  
/b/{username}/api/status   → Brain stats
/b/{username}/api/search   → Search across user's pages
/b/{username}/mcp          → MCP server (JSON-RPC)
/b/{username}/llms.txt     → Agent-readable brain map
```

## Ingestion Pipeline (Multi-User)

### Current (Prototype): Local gh CLI
```python
# Hardcoded to Preetham's machine
gh api users/pkyanam/repos
```

### Target (Production): GitHub OAuth
```typescript
// User authorizes via OAuth → token stored in Clerk user metadata
// Ingestion service uses user's token to fetch THEIR repos
const token = await getGitHubToken(userId);
const repos = await fetch("https://api.github.com/user/repos", {
  headers: { Authorization: `Bearer ${token}` }
});
```

## API Design (User-Scoped)

All brain APIs are scoped to a user:

```
GET  /api/brain/health?username=preetham       → Preetham's brain stats
GET  /api/brain/search?q=ai&username=preetham  → Search Preetham's brain
POST /api/ingest/github                         → body: { username: "preetham" }
```

Or via URL path (recommended):
```
GET  /b/preetham/api/status
GET  /b/preetham/api/search?q=ai
POST /b/preetham/api/ingest/github
```

## Migration Path

1. **v0.2 (now):** Namespace prefix, local gh CLI
2. **v0.3:** Add Clerk auth, RLS on Supabase, GitHub OAuth ingestion
3. **v0.4:** X + Calendar OAuth
4. **v1.0:** Per-user projects, billing, scale

## Environment Variables

```bash
# Required for production
GBRAIN_BIN=/path/to/gbrain         # GBrain CLI binary
SUPABASE_URL=https://...           # Supabase project URL
SUPABASE_ANON_KEY=...              # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY=...      # For server-side RLS bypass
CLERK_SECRET_KEY=...               # Clerk auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...  # Clerk frontend
GITHUB_CLIENT_ID=...               # GitHub OAuth app
GITHUB_CLIENT_SECRET=...           # GitHub OAuth secret
```
