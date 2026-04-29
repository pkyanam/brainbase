"use client";

import { useState, useEffect } from "react";

function useBaseUrl() {
  const [baseUrl, setBaseUrl] = useState("https://brainbase.belweave.ai");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);
  return baseUrl;
}

export default function Docs() {
  const baseUrl = useBaseUrl();
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Documentation</h1>
      <p className="text-neutral-500 mb-12">Give your AI agents persistent memory in one API call.</p>

      <section id="quickstart" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">Quickstart</h2>
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
          <pre className="text-sm text-neutral-300 overflow-x-auto">
            <code>{`npm install brainbase-sdk`}</code>
          </pre>
        </div>
      </section>

      <section id="sdk" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">SDK Usage</h2>
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
          <pre className="text-sm text-neutral-300 overflow-x-auto leading-relaxed">
            <code>{`import { Brainbase } from "brainbase-sdk";

const brain = new Brainbase({ apiKey: "bb_live_..." });

// Search your brain
const results = await brain.search("who do I know at Apple?");
// → [{ slug: "people/tim-cook", title: "Tim Cook", score: 0.92, ... }]

// Get a page
const page = await brain.getPage("people/garry-tan");
// → { title: "Garry Tan", content: "...", links: [...], timeline: [...] }

// Brain health
const stats = await brain.health();
// → { page_count: 687, link_count: 257, brain_score: 75 }

// Full knowledge graph
const graph = await brain.graph();
// → { nodes: [...], edges: [...] }

// Page links
const links = await brain.links("people/preetham-kyanam");
// → { outgoing: [...], incoming: [...] }`}</code>
          </pre>
        </div>
      </section>

      <section id="mcp" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">MCP Server</h2>
        <p className="text-sm text-neutral-400 mb-3">Connect any MCP-compatible agent directly:</p>
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
          <pre className="text-sm text-neutral-300 overflow-x-auto">
            <code>{`// OpenCode / Claude Code / Cursor config
{
  "mcpServers": {
    "brainbase": {
      "command": "node",
      "args": ["brainbase-mcp"],
      "env": { "BRAINBASE_URL": "${baseUrl}" }
    }
  }
}`}</code>
          </pre>
        </div>
        <p className="text-sm text-neutral-400 mt-3">
          Or use the HTTP endpoint: <code className="text-neutral-300">POST /api/mcp</code> with{" "}
          <code className="text-neutral-300">Authorization: Bearer bb_live_...</code>
        </p>
      </section>

      <section id="cli" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">CLI</h2>
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
          <pre className="text-sm text-neutral-300 overflow-x-auto">
            <code>{`brainbase search "garry tan"
brainbase health
brainbase page "people/garry-tan"
brainbase links "people/preetham-kyanam"
brainbase graph`}</code>
          </pre>
        </div>
      </section>

      <section id="api" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">API Reference</h2>
        <p className="text-sm text-neutral-400 mb-4">All read endpoints are public. Write endpoints require API key auth.</p>

        <h3 className="text-sm font-semibold text-neutral-300 mb-3">Read</h3>
        <div className="space-y-3 mb-8">
          <div className="border border-neutral-900 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-xs font-mono rounded">GET</span>
              <code className="text-sm text-neutral-300">/api/brain/health</code>
            </div>
            <p className="text-sm text-neutral-500">Brain statistics and health score.</p>
          </div>
          <div className="border border-neutral-900 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-xs font-mono rounded">GET</span>
              <code className="text-sm text-neutral-300">/api/brain/stats</code>
            </div>
            <p className="text-sm text-neutral-500">Detailed brain statistics (pages by type, embed coverage, most connected).</p>
          </div>
          <div className="border border-neutral-900 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-xs font-mono rounded">GET</span>
              <code className="text-sm text-neutral-300">/api/brain/search?q=...</code>
            </div>
            <p className="text-sm text-neutral-500">Full-text + ILIKE search across all pages.</p>
          </div>
          <div className="border border-neutral-900 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-xs font-mono rounded">GET</span>
              <code className="text-sm text-neutral-300">/api/brain/list?type=&limit=&offset=</code>
            </div>
            <p className="text-sm text-neutral-500">List all pages with metadata. Filter by type.</p>
          </div>
          <div className="border border-neutral-900 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-xs font-mono rounded">GET</span>
              <code className="text-sm text-neutral-300">/api/brain/page/&lt;slug&gt;</code>
            </div>
            <p className="text-sm text-neutral-500">Single page with content, links, and timeline.</p>
          </div>
          <div className="border border-neutral-900 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-xs font-mono rounded">GET</span>
              <code className="text-sm text-neutral-300">/api/brain/timeline/&lt;slug&gt;</code>
            </div>
            <p className="text-sm text-neutral-500">Timeline entries for a page.</p>
          </div>
          <div className="border border-neutral-900 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-xs font-mono rounded">GET</span>
              <code className="text-sm text-neutral-300">/api/brain/graph</code>
            </div>
            <p className="text-sm text-neutral-500">Full knowledge graph (nodes + edges).</p>
          </div>
          <div className="border border-neutral-900 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-xs font-mono rounded">GET</span>
              <code className="text-sm text-neutral-300">/api/brain/traverse?slug=&depth=&direction=</code>
            </div>
            <p className="text-sm text-neutral-500">Graph traversal from a page (out/in/both, max depth 5).</p>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-neutral-300 mb-3">Write (Auth Required)</h3>
        <div className="space-y-3 mb-8">
          <div className="border border-neutral-900 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-blue-950 text-blue-400 text-xs font-mono rounded">PUT</span>
              <code className="text-sm text-neutral-300">/api/brain/page/&lt;slug&gt;</code>
            </div>
            <p className="text-sm text-neutral-500">Create or update a page. Body: {`{title, type?, content?, frontmatter?}`}</p>
          </div>
          <div className="border border-neutral-900 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-red-950 text-red-400 text-xs font-mono rounded">DELETE</span>
              <code className="text-sm text-neutral-300">/api/brain/page/&lt;slug&gt;</code>
            </div>
            <p className="text-sm text-neutral-500">Delete a page and its associated data.</p>
          </div>
          <div className="border border-neutral-900 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-blue-950 text-blue-400 text-xs font-mono rounded">POST</span>
              <code className="text-sm text-neutral-300">/api/brain/link</code>
            </div>
            <p className="text-sm text-neutral-500">Create a link. Body: {`{from, to, link_type?}`}</p>
          </div>
          <div className="border border-neutral-900 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-red-950 text-red-400 text-xs font-mono rounded">DELETE</span>
              <code className="text-sm text-neutral-300">/api/brain/link</code>
            </div>
            <p className="text-sm text-neutral-500">Remove a link. Body: {`{from, to}`}</p>
          </div>
          <div className="border border-neutral-900 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-blue-950 text-blue-400 text-xs font-mono rounded">POST</span>
              <code className="text-sm text-neutral-300">/api/brain/timeline</code>
            </div>
            <p className="text-sm text-neutral-500">Add timeline entry. Body: {`{slug, date, summary, detail?, source?}`}</p>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-neutral-300 mb-3">MCP</h3>
        <div className="border border-neutral-900 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-0.5 bg-amber-950 text-amber-400 text-xs font-mono rounded">POST</span>
            <code className="text-sm text-neutral-300">/api/mcp</code>
          </div>
          <p className="text-sm text-neutral-500">JSON-RPC MCP endpoint. 16 tools: search, query, get_page, get_links, get_backlinks, get_timeline, get_health, get_stats, get_graph, list_pages, traverse_graph, put_page, delete_page, add_link, remove_link, add_timeline_entry.</p>
        </div>
      </section>

      <section id="architecture" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">Architecture</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">
          Brainbase is powered by{" "}
          <a href="https://github.com/garrytan/gstack" className="text-violet-400 hover:underline">GStack</a>{" "}
          (86K GitHub stars) and{" "}
          <a href="https://github.com/garrytan/gbrain" className="text-violet-400 hover:underline">GBrain</a>{" "}
          (12K stars) by Garry Tan. Each user gets their own isolated Postgres database on Supabase
          with pgvector for hybrid search. The knowledge graph uses typed wikilinks for relational
          queries that vector search alone can&apos;t reach.
        </p>
      </section>
    </div>
  );
}
