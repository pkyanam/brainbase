# Brainbase — Agent Instructions

Brainbase is a knowledge graph API for AI agents. It gives agents persistent memory via a polyglot database: Supabase Postgres + pgvector (system of record) + Neo4j (graph projection). Your job is to read from the brain before answering, and write to the brain when you learn something new.

## Quick Start

```bash
# CLI
brainbase search "who do I know at Apple?"
brainbase health
brainbase page "people/garry-tan"
brainbase pagerank              # graph intelligence
brainbase communities           # cluster detection

# SDK
npm install brainbase-sdk
```

## Architecture

- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + Three.js
- **Database:** Polyglot — Supabase Postgres + pgvector (system of record) + Neo4j (derived graph)
- **Auth:** Clerk v7 (GitHub OAuth)
- **Search:** Hybrid (FTS + pgvector), RRF fusion, intent classifier, 7-stage gated pipeline
- **Graph Intelligence:** PageRank, Louvain communities, shortest path, node similarity (via Neo4j GDS or fallbacks)
- **MCP:** JSON-RPC 2.0, 23 tools
- **Background:** Dream cycle crons + Minions job queue + graph-sync phase

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Supabase connection pool |
| `src/lib/neo4j/driver.ts` | Neo4j driver with health checks |
| `src/lib/graph-router.ts` | Backend selection (Postgres vs Neo4j) for graph reads |
| `src/lib/neo4j/sync.ts` | Postgres → Neo4j projection (dream cycle phase) |
| `src/lib/neo4j/intel.ts` | Graph intelligence: PageRank, communities, shortest path, similarity |
| `src/lib/supabase/search.ts` | Search pipeline (FTS + vector + RRF) |
| `src/lib/supabase/hybrid.ts` | RRF fusion, intent classifier, boosting |
| `src/lib/supabase/health.ts` | Brain health stats |
| `src/lib/supabase/pages.ts` | Page CRUD |
| `src/lib/dream-cycle.ts` | Autonomous enrichment (extract, embed, orphans, patterns, graph-sync) |
| `src/lib/embeddings.ts` | OpenAI embedding generation |
| `src/lib/minions/` | Background job queue |
| `src/app/api/mcp/route.ts` | MCP server (23 tools) |

## Graph Intelligence

Neo4j-powered graph analysis (with Postgres fallbacks):

| Endpoint | Description |
|----------|-------------|
| `GET /api/brain/intel/pagerank` | PageRank centrality scores |
| `GET /api/brain/intel/communities` | Louvain community detection |
| `GET /api/brain/intel/shortest-path` | Shortest path between two pages |
| `GET /api/brain/intel/similar` | Node similarity (Jaccard/Cosine) |

## Graph Backend Selection

Set `BRAINBASE_GRAPH_BACKEND` to control graph query routing:
- `auto` (default): Try Neo4j first, fall back to Postgres on any error
- `postgres`: Always use Postgres recursive CTEs
- `neo4j`: Neo4j only, no fallback (errors surface)

Neo4j requires `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` env vars.

## Rules

1. Read from the brain before external APIs
2. Write new knowledge back to the brain
3. Link related pages (typed edges)
4. Don't generate fake data — every metric must be verifiable
5. Use `search_files` not `terminal grep` for code search
6. Use `read_file` not `terminal cat` for reading files
7. Use `patch` not `terminal sed` for edits
