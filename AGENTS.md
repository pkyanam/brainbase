# Brainbase — Agent Instructions

Brainbase is a knowledge graph API for AI agents. It gives agents persistent memory via Supabase Postgres + pgvector. Your job is to read from the brain before answering, and write to the brain when you learn something new.

## Quick Start

```bash
# CLI
brainbase search "who do I know at Apple?"
brainbase health
brainbase page "people/garry-tan"

# SDK
npm install brainbase-sdk
```

## Architecture

- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + Three.js
- **Database:** Supabase Postgres + pgvector
- **Auth:** Clerk v7 (GitHub OAuth)
- **Search:** Hybrid (FTS + pgvector), RRF fusion, intent classifier, 7-stage gated pipeline
- **MCP:** JSON-RPC 2.0, 12 tools
- **Background:** Dream cycle crons + Minions job queue

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Supabase connection pool |
| `src/lib/supabase/search.ts` | Search pipeline (FTS + vector + RRF) |
| `src/lib/supabase/hybrid.ts` | RRF fusion, intent classifier, boosting |
| `src/lib/supabase/health.ts` | Brain health stats |
| `src/lib/supabase/pages.ts` | Page CRUD |
| `src/lib/dream-cycle.ts` | Autonomous enrichment (extract, embed, orphans, patterns) |
| `src/lib/embeddings.ts` | OpenAI embedding generation |
| `src/lib/minions/` | Background job queue |
| `src/app/api/mcp/route.ts` | MCP server (12 tools) |

## Current State

- 720 pages, 554 typed links, 918 chunks, 847 timeline entries
- Brain score: 76/100
- Search eval: MRR 0.83, P@3 0.49, R@10 0.85
- Embed coverage: actively catching up via dream cycle

## Rules

1. Read from the brain before external APIs
2. Write new knowledge back to the brain
3. Link related pages (typed edges)
4. Don't generate fake data — every metric must be verifiable
5. Use `search_files` not `terminal grep` for code search
6. Use `read_file` not `terminal cat` for reading files
7. Use `patch` not `terminal sed` for edits
