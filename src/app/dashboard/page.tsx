"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useUser, SignOutButton } from "@clerk/nextjs";
import type { GraphNode } from "@/lib/supabase/graph";

const BrainGalaxy = dynamic(() => import("@/components/BrainGalaxy"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <span className="text-sm text-neutral-600">Loading 3D graph...</span>
    </div>
  ),
});

interface BrainStats {
  page_count: number;
  chunk_count: number;
  link_count: number;
  embed_coverage: number;
  brain_score: number;
  pages_by_type: Record<string, number>;
  most_connected: { slug: string; title: string; link_count: number }[];
}

interface SearchResult {
  slug: string;
  title: string;
  type: string;
  excerpt: string;
  score: number;
}

interface PageDetail {
  slug: string;
  title: string;
  type: string;
  content: string;
  links?: { outgoing: { slug: string; title: string; link_type: string }[]; incoming: { slug: string; title: string; link_type: string }[] };
  timeline?: { date: string; summary: string }[];
}

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const [stats, setStats] = useState<BrainStats | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedPage, setSelectedPage] = useState<PageDetail | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: { source: string; target: string; type: string }[] } | null>(null);
  const [graphError, setGraphError] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load stats
  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/brain/health")
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then((d) => { setStats(d); setStatsError(false); })
      .catch(() => setStatsError(true));
  }, [isLoaded, user]);

  // Load graph
  useEffect(() => {
    if (!isLoaded || !user) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    fetch("/api/brain/graph", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then((d) => { clearTimeout(timeout); setGraphData(d); setGraphError(false); })
      .catch(() => { clearTimeout(timeout); setGraphError(true); });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, [isLoaded, user]);

  // Load API key
  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/keys")
      .then((r) => r.json())
      .then((d) => {
        if (d.keys?.length > 0) {
          // We don't store full keys, but we can show the prefix
          setApiKey(d.keys[0].key_prefix + "...···");
        }
      })
      .catch(() => {});
  }, [isLoaded, user]);

  // Debounced search
  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(() => {
      fetch(`/api/brain/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setResults(Array.isArray(d) ? d : []))
        .catch(() => {});
    }, 200);
  }, []);

  // Select node
  const handleSelectNode = useCallback(async (slug: string) => {
    try {
      const r = await fetch(`/api/brain/page/${encodeURIComponent(slug)}`);
      if (!r.ok) return;
      const page = await r.json();
      setSelectedPage(page);
      setSidebarOpen(true);
    } catch { }
  }, []);

  const pageTypes = stats?.pages_by_type || {};

  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden">
      {/* Nav */}
      <header className="shrink-0 h-12 flex items-center justify-between px-6 border-b border-neutral-900">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">B</span>
          </div>
          <span className="text-sm font-medium text-white tracking-tight">brainbase</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <a href="/" className="hover:text-neutral-300 transition-colors">Home</a>
          <a href="/docs" className="hover:text-neutral-300 transition-colors">Docs</a>
          {isLoaded && user ? (
            <>
              <a href="/settings" className="hover:text-neutral-300 transition-colors">Settings</a>
              <span className="font-mono text-neutral-700">|</span>
              <span className="text-neutral-400">{user.primaryEmailAddress?.emailAddress?.split("@")[0] || user.id.slice(0, 6)}</span>
              <SignOutButton>
                <button className="text-neutral-500 hover:text-neutral-300 transition-colors">Sign out</button>
              </SignOutButton>
            </>
          ) : (
            <a href="/sign-in" className="text-violet-400 hover:text-violet-300 transition-colors">Sign in</a>
          )}
          <span className="font-mono text-neutral-700">|</span>
          <span className="font-mono text-cyan-500 text-[11px]">MCP: /api/mcp</span>
          {statsError ? (
            <span className="text-red-400">API offline</span>
          ) : (
            <span className="text-neutral-600">{stats?.page_count ?? "—"} pages</span>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Stats bar */}
          <div className="shrink-0 px-6 py-4 flex items-center gap-4 border-b border-neutral-900 overflow-x-auto">
            {[
              { label: "Pages", value: stats?.page_count, color: "violet" },
              { label: "Links", value: stats?.link_count, color: "cyan" },
              { label: "People", value: pageTypes.person, color: "rose" },
              { label: "Companies", value: pageTypes.company, color: "cyan" },
              { label: "Projects", value: pageTypes.project, color: "emerald" },
              { label: "Score", value: stats?.brain_score, suffix: "/100", color: "amber" },
            ].map((s) => (
              <div key={s.label} className="flex items-baseline gap-2 shrink-0">
                <span className="text-neutral-600 text-xs uppercase tracking-wide font-medium">{s.label}</span>
                <span className={`text-lg font-bold tabular-nums ${s.color === "violet" ? "text-violet-400" : s.color === "cyan" ? "text-cyan-400" : s.color === "rose" ? "text-rose-400" : s.color === "emerald" ? "text-emerald-400" : "text-amber-400"}`}>
                  {s.value ?? "—"}{s.suffix || ""}
                </span>
              </div>
            ))}
            {statsError && <span className="text-xs text-red-400">Stats unavailable — API may be down</span>}
          </div>

          {/* Search */}
          <div className="shrink-0 px-6 py-3">
            <div className={`relative max-w-lg ${searchFocused ? "ring-1 ring-neutral-700 rounded-lg" : ""}`}>
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Search your brain..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none"
              />
              {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-72 overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl">
                  {results.map((r) => (
                    <button
                      key={r.slug}
                      onClick={() => { handleSelectNode(r.slug); setQuery(""); setResults([]); }}
                      className="w-full text-left px-4 py-3 hover:bg-neutral-900 transition-colors border-b border-neutral-900 last:border-0"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono uppercase text-neutral-500">{r.type}</span>
                        <span className="text-[10px] text-neutral-600">{Math.round(r.score * 100)}%</span>
                      </div>
                      <span className="text-sm font-medium text-neutral-200">{r.title}</span>
                      {r.excerpt && <p className="text-xs text-neutral-600 mt-0.5 line-clamp-1">{r.excerpt}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* API Key banner */}
          {isLoaded && user && (
            <div className="shrink-0 px-6 pb-2">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-neutral-600">API key:</span>
                {apiKey ? (
                  <>
                    <code className="text-neutral-400 font-mono bg-neutral-950 px-2 py-1 rounded border border-neutral-900">{showKey ? apiKey : apiKey.slice(0, 16) + "...···"}</code>
                    <button onClick={() => setShowKey(!showKey)} className="text-neutral-500 hover:text-neutral-300 transition-colors">
                      {showKey ? "Hide" : "Show"}
                    </button>
                    <a href="/settings" className="text-violet-400 hover:text-violet-300 transition-colors">Manage keys →</a>
                  </>
                ) : (
                  <a href="/settings" className="text-violet-400 hover:text-violet-300 transition-colors">Create API key →</a>
                )}
              </div>
            </div>
          )}

          {/* 3D Graph or Fallback */}
          <div className="flex-1 min-h-0 px-6 pb-6">
            <div className="h-full rounded-xl overflow-hidden border border-neutral-900 bg-neutral-950">
              {graphError ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-neutral-400 text-sm mb-2">3D graph unavailable</p>
                    <p className="text-neutral-600 text-xs">Use the CLI or MCP endpoint to query the brain directly.</p>
                    <code className="text-xs text-cyan-500 mt-2 block font-mono">brainbase query &quot;anything&quot;</code>
                  </div>
                </div>
              ) : !graphData ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-neutral-800 border-t-neutral-400 rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-neutral-600">Loading graph...</p>
                  </div>
                </div>
              ) : graphData.nodes.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-neutral-400 text-sm mb-2">No graph data</p>
                    <p className="text-neutral-600 text-xs">Import contacts or add pages to build your graph.</p>
                  </div>
                </div>
              ) : (
                <BrainGalaxy
                  nodes={graphData.nodes}
                  edges={graphData.edges}
                  onSelectNode={handleSelectNode}
                />
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className={`shrink-0 border-l border-neutral-900 bg-neutral-950/90 backdrop-blur transition-all duration-300 overflow-hidden ${sidebarOpen && selectedPage ? "w-96" : "w-0"}`}>
          {sidebarOpen && selectedPage && (
            <div className="w-96 h-full flex flex-col">
              <div className="shrink-0 px-5 py-4 flex items-start justify-between border-b border-neutral-900">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-violet-400">{selectedPage.type}</span>
                  <h2 className="text-base font-semibold text-neutral-100 mt-1">{selectedPage.title}</h2>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-neutral-500 hover:text-neutral-300 text-lg leading-none shrink-0 ml-3">×</button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {selectedPage.links && (selectedPage.links.outgoing.length > 0 || selectedPage.links.incoming.length > 0) && (
                  <div className="mb-4">
                    <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Links</h3>
                    {selectedPage.links.outgoing.slice(0, 8).map((l) => (
                      <button key={l.slug + l.link_type} onClick={() => handleSelectNode(l.slug)}
                        className="block w-full text-left text-xs py-1.5 px-2 rounded hover:bg-neutral-900 transition-colors group">
                        <span className="text-neutral-300 group-hover:text-white">{l.title}</span>
                        <span className="text-neutral-600 ml-2 font-mono">{l.link_type}</span>
                      </button>
                    ))}
                    {selectedPage.links.incoming.slice(0, 4).map((l) => (
                      <button key={l.slug + l.link_type} onClick={() => handleSelectNode(l.slug)}
                        className="block w-full text-left text-xs py-1.5 px-2 rounded hover:bg-neutral-900 transition-colors group">
                        <span className="text-neutral-400 group-hover:text-neutral-200">← {l.title}</span>
                        <span className="text-neutral-600 ml-2 font-mono">{l.link_type}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="text-sm text-neutral-400 leading-relaxed whitespace-pre-wrap">
                  {selectedPage.content || <span className="text-neutral-700">No content</span>}
                </div>
                {selectedPage.timeline && selectedPage.timeline.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-neutral-900">
                    <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Timeline</h3>
                    {selectedPage.timeline.map((t, i) => (
                      <div key={i} className="text-xs mb-2 pl-2 border-l border-neutral-800">
                        <span className="text-neutral-500 font-mono">{t.date}</span>
                        <p className="text-neutral-400 mt-0.5">{t.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 px-5 py-3 border-t border-neutral-900">
                <code className="text-[10px] text-neutral-600 font-mono">{selectedPage.slug}</code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
