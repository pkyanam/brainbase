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
      <p className="text-bb-text-muted mb-12">Give your AI agents persistent memory in one API call.</p>

      <section id="quickstart" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">Quickstart</h2>
        <div className="bg-bb-bg-secondary border border-bb-border rounded-xl p-5">
          <pre className="text-sm text-bb-text-secondary overflow-x-auto">
            <code>{`npm install brainbase-sdk`}</code>
          </pre>
        </div>
      </section>

      <section id="sdk" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">SDK Usage</h2>
        <div className="bg-bb-bg-secondary border border-bb-border rounded-xl p-5">
          <pre className="text-sm text-bb-text-secondary overflow-x-auto leading-relaxed">
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
        <p className="text-sm text-bb-text-secondary mb-3">Connect any MCP-compatible agent directly:</p>
        <div className="bg-bb-bg-secondary border border-bb-border rounded-xl p-5">
          <pre className="text-sm text-bb-text-secondary overflow-x-auto">
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
        <p className="text-sm text-bb-text-secondary mt-3">
          Or use the HTTP endpoint: <code className="text-bb-text-primary">POST /api/mcp</code> with{" "}
          <code className="text-bb-text-primary">Authorization: Bearer bb_liv...</code>
        </p>
      </section>

      <section id="cli" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">CLI</h2>
        <div className="bg-bb-bg-secondary border border-bb-border rounded-xl p-5">
          <pre className="text-sm text-bb-text-secondary overflow-x-auto">
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
        <p className="text-sm text-bb-text-secondary mb-4">All read endpoints are public. Write endpoints require API key auth.</p>

        <h3 className="text-sm font-semibold text-bb-text-primary mb-3">Read</h3>
        <div className="space-y-3 mb-8">
          {[
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/health", desc: "Brain statistics and health score." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/stats", desc: "Detailed brain statistics (pages by type, embed coverage, most connected)." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/search?q=...", desc: "Full-text + ILIKE search across all pages." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/list?type=&limit=&offset=", desc: "List all pages with metadata. Filter by type." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/page/<slug>", desc: "Single page with content, links, and timeline." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/timeline/<slug>", desc: "Timeline entries for a page." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/graph", desc: "Full knowledge graph (nodes + edges)." },
            { method: "GET", color: "bg-bb-accent/10 text-bb-accent", path: "/api/brain/traverse?slug=&depth=&direction=", desc: "Graph traversal from a page (out/in/both, max depth 5)." },
          ].map((ep) => (
            <div key={ep.path} className="border border-bb-border rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-0.5 text-xs font-mono rounded ${ep.color}`}>{ep.method}</span>
                <code className="text-sm text-bb-text-primary">{ep.path}</code>
              </div>
              <p className="text-sm text-bb-text-muted">{ep.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-bb-text-primary mb-3">Write (Auth Required)</h3>
        <div className="space-y-3 mb-8">
          {[
            { method: "PUT", color: "bg-bb-accent-dim/20 text-bb-accent-dim", path: "/api/brain/page/<slug>", desc: "Create or update a page. Body: {title, type?, content?, frontmatter?}" },
            { method: "DELETE", color: "bg-red-900/20 text-red-400", path: "/api/brain/page/<slug>", desc: "Delete a page and its associated data." },
            { method: "POST", color: "bg-bb-accent-dim/20 text-bb-accent-dim", path: "/api/brain/link", desc: "Create a link. Body: {from, to, link_type?}" },
            { method: "DELETE", color: "bg-red-900/20 text-red-400", path: "/api/brain/link", desc: "Remove a link. Body: {from, to}" },
            { method: "POST", color: "bg-bb-accent-dim/20 text-bb-accent-dim", path: "/api/brain/timeline", desc: "Add timeline entry. Body: {slug, date, summary, detail?, source?}" },
          ].map((ep) => (
            <div key={ep.path} className="border border-bb-border rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-0.5 text-xs font-mono rounded ${ep.color}`}>{ep.method}</span>
                <code className="text-sm text-bb-text-primary">{ep.path}</code>
              </div>
              <p className="text-sm text-bb-text-muted">{ep.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-bb-text-primary mb-3">MCP</h3>
        <div className="border border-bb-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-0.5 bg-bb-accent-glow text-bb-accent text-xs font-mono rounded">POST</span>
            <code className="text-sm text-bb-text-primary">/api/mcp</code>
          </div>
          <p className="text-sm text-bb-text-muted">JSON-RPC MCP endpoint. 16 tools: search, query, get_page, get_links, get_backlinks, get_timeline, get_health, get_stats, get_graph, list_pages, traverse_graph, put_page, delete_page, add_link, remove_link, add_timeline_entry.</p>
        </div>
      </section>

      <section id="architecture" className="mb-12 scroll-mt-24">
        <h2 className="text-lg font-semibold mb-3">Architecture</h2>
        <p className="text-sm text-bb-text-secondary leading-relaxed">
          Brainbase is powered by{" "}
          <a href="https://github.com/garrytan/gstack" className="text-bb-accent hover:underline">GStack</a>{" "}
          (86K GitHub stars) and{" "}
          <a href="https://github.com/garrytan/gbrain" className="text-bb-accent hover:underline">GBrain</a>{" "}
          (12K stars) by Garry Tan. Each user gets their own isolated Postgres database on Supabase
          with pgvector for hybrid search. The knowledge graph uses typed wikilinks for relational
          queries that vector search alone can&apos;t reach.
        </p>
      </section>
    </div>
  );
}
