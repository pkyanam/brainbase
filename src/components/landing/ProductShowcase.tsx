"use client";

import { useState } from "react";
import { Code, Terminal, Plugs } from "@phosphor-icons/react";

const tabs = [
  {
    id: "sdk",
    label: "SDK",
    icon: Code,
    description: "npm install brainbase-sdk",
    code: `import { Brainbase } from "brainbase-sdk";

const brain = new Brainbase({ apiKey: "bb_live_..." });

// Hybrid search: FTS + vector + graph
const results = await brain.search("Garry Tan");

// Typed page retrieval
const page = await brain.getPage("people/garry-tan");

// Graph intelligence powered by Neo4j
const influential = await brain.pageRank(25);
const path = await brain.shortestPath("a", "b");`,
  },
  {
    id: "cli",
    label: "CLI",
    icon: Terminal,
    description: "Terminal-native interface",
    code: `$ npx brainbase config set apiKey bb_live_...

$ brainbase search "authentication"
Found 12 pages matching "authentication"
  auth/oauth-setup (score: 0.94)
  docs/security-model (score: 0.87)
  ...

$ brainbase ask "How does our auth work?"
Based on 4 sources: OAuth2 with PKCE flow...

$ brainbase pagerank --top 10
Ranking complete. Top entities:
  1. people/cto (0.089)
  2. projects/api-v2 (0.076)`,
  },
  {
    id: "mcp",
    label: "MCP",
    icon: Plugs,
    description: "23 tools for Claude, Cursor, etc.",
    code: `// Claude Desktop config
{
  "mcpServers": {
    "brainbase": {
      "url": "https://brainbase.dev/b/yourname/mcp"
    }
  }
}

// Now Claude can:
// - search your brain
// - read and write pages
// - traverse the knowledge graph
// - ask questions with RAG
// - run graph algorithms`,
  },
];

export function ProductShowcase() {
  const [activeTab, setActiveTab] = useState("sdk");
  const activeContent = tabs.find((t) => t.id === activeTab);

  return (
    <section className="py-24 md:py-32 bg-bb-bg-secondary border-y border-bb-border">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-sm font-medium text-bb-accent uppercase tracking-wider">
            Interfaces
          </span>
          <h2 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
            Three ways in. One brain.
          </h2>
          <p className="mt-4 text-bb-text-secondary text-lg max-w-2xl mx-auto">
            Same knowledge graph, delivered the way you work.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-1 p-1 bg-bb-bg-primary rounded-lg border border-bb-border">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? "bg-bb-surface text-bb-text-primary"
                      : "text-bb-text-muted hover:text-bb-text-secondary"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Code preview */}
        <div className="max-w-4xl mx-auto">
          <div className="rounded-xl border border-bb-border bg-bb-bg-primary overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-bb-border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-bb-border" />
                <div className="w-3 h-3 rounded-full bg-bb-border" />
                <div className="w-3 h-3 rounded-full bg-bb-border" />
              </div>
              <span className="text-xs text-bb-text-muted font-mono">
                {activeContent?.description}
              </span>
              <div className="w-16" />
            </div>

            {/* Code content */}
            <div className="p-6 overflow-x-auto">
              <pre className="text-sm font-mono text-bb-text-secondary leading-relaxed">
                <code>{activeContent?.code}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
