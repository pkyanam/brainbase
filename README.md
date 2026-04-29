# Brainbase

**Give your AI agents a memory.**

One API call. Your agents remember everything. Brainbase is the persistent knowledge layer that turns every AI agent into an expert on your world.

## What is it?

Brainbase is a knowledge graph API for AI agents. Every user gets their own isolated Postgres database (via Supabase) with:

- **Hybrid search** — full-text + semantic via pgvector
- **Typed wikilinks** — relational queries that vector search alone can't reach
- **Self-enriching** — links extracted, timelines built, orphans reconnected automatically
- **MCP-native** — drop one URL into any MCP-compatible agent (Claude Code, Cursor, OpenCode)

## Quickstart

```bash
npm install brainbase-sdk
```

```ts
import { Brainbase } from "brainbase-sdk";

const brain = new Brainbase({ apiKey: "bb_live_..." });

const results = await brain.query("who do I know at YC?");
// → [{ slug: "people/garry-tan", title: "Garry Tan", score: 0.97 }]
```

## Architecture

- **Frontend:** Next.js 16 + React 19 + Tailwind CSS + Three.js 3D graph
- **API:** REST + MCP (JSON-RPC + SSE)
- **Database:** Postgres + pgvector on Supabase
- **Auth:** Clerk
- **SDK:** TypeScript, MCP-native
- **CLI:** Node.js, zero dependencies

## Development

```bash
npm install
npm run dev
```

Set your environment variables in `.env.local`:

```
SUPABASE_DATABASE_URL=postgresql://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/brain/health` | GET | Brain statistics |
| `/api/brain/search?q=` | GET | Full-text search |
| `/api/brain/page/<slug>` | GET | Page detail |
| `/api/brain/graph` | GET | Knowledge graph |
| `/api/mcp` | POST | MCP JSON-RPC |
| `/api/keys` | POST/GET/DELETE | API key management |
| `/b/<user>/api/status` | GET | Public brain status |
| `/b/<user>/llms.txt` | GET | Agent-readable summary |

## CLI

```bash
brainbase search "garry tan"
brainbase health
brainbase page "people/garry-tan"
brainbase links "people/preetham-kyanam"
```

## License

MIT
