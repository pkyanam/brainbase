# Brainbase SDK

Official JavaScript/TypeScript SDK for [Brainbase](https://brainbase.belweave.ai) — the knowledge graph API for AI agents.

**Note:** Brainbase uses a polyglot storage architecture: Supabase Postgres + pgvector (system of record) with an optional Neo4j graph projection. The SDK talks to the Brainbase API, which handles backend routing automatically.

## Install

```bash
npm install brainbase-sdk
```

## Quick Start

```ts
import { Brainbase } from "brainbase-sdk";

const brain = new Brainbase({
  apiKey: "bb_live_...",
  // baseUrl: "https://brainbase.belweave.ai",  // defaults to production
  // brainId: "<uuid>",                          // for multi-tenant setups
  // timeoutMs: 30_000,                          // default 30s
});

// Read
const results = await brain.search("garry tan");
const page = await brain.getPage("people/garry-tan");
const health = await brain.health();
const graph = await brain.graph();

// Write
await brain.putPage({
  slug: "ideas/my-idea",
  title: "My New Idea",
  type: "idea",
  content: "# Hello world",
});
await brain.addLink("people/jane", "companies/acme", "works_at");
```

## Enrichment

Create rich, sourced pages for people and companies with one call:

```ts
// Tier 2 (standard) — Brave web search + OpenAI formatting, <10s
const result = await brain.enrich({
  name: "Satya Nadella",
  type: "person",
  tier: 2,
});

// result.sources === ["brave", "openai"]
// result._diag?.braveResults === 5
// result.compiledTruth includes birth date, birthplace, career details with citations

// Tier 1 (deep research) — async, returns job ID
const queued = await brain.enrich({ name: "Garry Tan", type: "person", tier: 1 });
// { queued: true, jobId: 42, tier: 1, message: "..." }

// Tier 3 (quick) — OpenAI only, <5s
const quick = await brain.enrich({ name: "Jane Doe", type: "person", tier: 3 });

// With context (1.6-1.9x richer pages)
const rich = await brain.enrich({
  name: "Tom Blomfield",
  type: "person",
  tier: 2,
  context: "YC group partner, formerly CEO/founder of Monzo",
});
```

## API Reference

### Read Operations

| Method | Description |
|--------|-------------|
| `search(query)` | Full-text + ILIKE search |
| `query(question)` | Natural language hybrid search |
| `ask(question)` | LLM-generated answer with cited sources |
| `getPage(slug)` | Full page with content, links, timeline |
| `health()` | Brain health dashboard |
| `stats()` | Detailed brain statistics |
| `graph()` | Full knowledge graph (nodes + edges) |
| `links(slug)` | Outgoing + incoming links |
| `backlinks(slug)` | Pages linking to this one |
| `timeline(slug)` | Timeline entries |
| `listPages(opts?)` | List all pages with type/author filters |
| `traverse(slug, opts?)` | Graph traversal with depth/direction |
| `getVersions(slug)` | Page version history |
| `getActivity(opts?)` | Brain activity feed |
| `getRawData(slug, source?)` | Stored provenance data |
| `getTags(slug)` | Tags on a page |

### Graph Intelligence (Neo4j)

| Method | Description |
|--------|-------------|
| `pageRank(limit?)` | Top pages by centrality (GDS or degree fallback) |
| `communities(limit?)` | Louvain community detection (requires GDS) |
| `shortestPath(from, to, maxDepth?)` | Shortest path between two pages |
| `similarPages(slug, limit?)` | Similar pages by link structure (GDS or Jaccard) |
| `graphSync()` | Trigger Postgres → Neo4j sync |

### Write Operations

| Method | Description |
|--------|-------------|
| `putPage(input)` | Create or update a page |
| `deletePage(slug)` | Delete a page |
| `addLink(from, to, type?, author?)` | Create a typed link |
| `removeLink(from, to)` | Remove a link |
| `addTimelineEntry(slug, date, summary, opts?)` | Add a timeline entry |
| `addTag(slug, tag)` | Add a tag |
| `removeTag(slug, tag)` | Remove a tag |
| `enrich(input)` | Enrich a person/company page |

### Job Management

| Method | Description |
|--------|-------------|
| `getJob(jobId)` | Job status by ID |
| `listJobs(opts?)` | List all jobs with status filter |
| `retryJob(jobId)` | Retry a failed job |

### API Key Management

| Method | Description |
|--------|-------------|
| `createApiKey(name)` | Create a new API key |
| `listApiKeys()` | List all API keys |
| `revokeApiKey(keyId)` | Revoke an API key |

## Error Handling

All methods throw `BrainbaseError` with a `code` property (HTTP status code) and descriptive `message`.

```ts
import { BrainbaseError } from "brainbase-sdk";

try {
  await brain.getPage("nonexistent");
} catch (err) {
  if (err instanceof BrainbaseError) {
    console.log(`Error ${err.code}: ${err.message}`);
  }
}
```

## TypeScript

Full type definitions included. All request/response types are exported:

```ts
import type {
  SearchResult, PageDetail, BrainHealth, GraphData,
  EnrichInput, EnrichResult, EnrichQueued,
  PutPageInput, AskResult, JobStatus,
  PageRankResponse, CommunitiesResponse, ShortestPathResponse,
  SimilarityResponse, GraphSyncResponse,
} from "brainbase-sdk";
```

## License

MIT
