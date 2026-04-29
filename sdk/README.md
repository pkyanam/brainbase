# Brainbase SDK

The official SDK for [Brainbase](https://brainbase.belweave.ai) — the knowledge graph API that gives your AI agents persistent memory.

## Install

```bash
npm install brainbase-sdk
```

Requires Node.js 18+ (uses native `fetch`).

## Quickstart

```ts
import { Brainbase } from "brainbase-sdk";

const brain = new Brainbase({
  apiKey: "bb_live_...",
  baseUrl: "https://brainbase.belweave.ai", // optional, defaults to localhost
});

// Search your brain
const results = await brain.search("who do I know at YC?");

// Get a page
const page = await brain.getPage("people/garry-tan");

// Check brain health
const health = await brain.health();
```

## API Reference

### Read Operations

- `brain.search(query)` — Full-text search
- `brain.query(question)` — Natural language query
- `brain.getPage(slug)` — Get page with links & timeline
- `brain.health()` — Brain statistics
- `brain.stats()` — Detailed statistics
- `brain.graph()` — Full knowledge graph
- `brain.links(slug)` — Get page links
- `brain.backlinks(slug)` — Incoming links
- `brain.timeline(slug)` — Timeline entries
- `brain.listPages(options?)` — List all pages
- `brain.traverse(slug, options?)` — Graph traversal

### Write Operations

- `brain.putPage(input)` — Create or update a page
- `brain.deletePage(slug)` — Delete a page
- `brain.addLink(from, to, linkType?)` — Create a link
- `brain.removeLink(from, to)` — Remove a link
- `brain.addTimelineEntry(slug, date, summary, options?)` — Add timeline event

### Error Handling

```ts
import { Brainbase, BrainbaseError } from "brainbase-sdk";

try {
  await brain.getPage("missing-page");
} catch (err) {
  if (err instanceof BrainbaseError) {
    console.log(err.code, err.message);
  }
}
```

## License

MIT
