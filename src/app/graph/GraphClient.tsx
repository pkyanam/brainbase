"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import type { GraphNode, GraphEdge } from "@/lib/supabase/graph";
import IntelPanel from "@/components/dashboard/IntelPanel";

const BrainGalaxy = nextDynamic(() => import("@/components/BrainGalaxy"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-6 h-6 border-2 border-bb-border border-t-bb-accent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-bb-text-muted">Loading graph…</p>
      </div>
    </div>
  ),
});

interface FilterTag {
  label: string;
  color: string;
  key: string;
}

const FILTER_TAGS: FilterTag[] = [
  { label: "All", color: "bg-bb-accent", key: "" },
  { label: "People", color: "bg-bb-cat-person", key: "person" },
  { label: "Companies", color: "bg-bb-cat-company", key: "company" },
  { label: "Projects", color: "bg-bb-cat-project", key: "project" },
];

export default function GraphClient() {
  const { user, isLoaded } = useUser();
  const [data, setData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);

  const fetchGraph = useCallback(async () => {
    try {
      const r = await fetch("/api/brain/graph");
      if (!r.ok) throw new Error();
      const d = await r.json();
      setData(d);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && user) fetchGraph();
  }, [isLoaded, user, fetchGraph]);

  const filtered = (() => {
    if (!data) return { nodes: [], edges: [] };
    if (!filter) return data;
    const nodeIds = new Set(data.nodes.filter((n) => n.type === filter).map((n) => n.id));
    return {
      nodes: data.nodes.filter((n) => nodeIds.has(n.id)),
      edges: data.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)),
    };
  })();

  const selectedNode = selectedId ? data?.nodes.find((n) => n.id === selectedId) : undefined;

  if (!isLoaded || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-bb-bg-primary">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-bb-border border-t-bb-accent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-bb-text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-bb-bg-primary overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 h-12 md:h-14 flex items-center justify-between px-4 md:px-6 border-b border-bb-border bg-bb-bg-primary z-20">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <svg className="w-4 h-4 text-bb-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-semibold tracking-tight text-bb-text-primary">brainbase</span>
          </Link>
          <span className="text-bb-border-strong hidden sm:inline">/</span>
          <span className="hidden sm:inline text-xs text-bb-text-muted font-mono">graph</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filters */}
          <div className="hidden sm:flex items-center gap-1">
            {FILTER_TAGS.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`h-7 px-2.5 rounded text-[11px] font-medium transition-colors ${
                  filter === t.key
                    ? `${t.color} text-bb-bg-primary`
                    : "bg-bb-surface text-bb-text-secondary hover:text-bb-text-primary border border-bb-border"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {data && (
            <span className="hidden sm:inline text-[10px] text-bb-text-muted tabular-nums border border-bb-border rounded px-2 py-1 bg-bb-surface">
              {filtered.nodes.length} nodes
            </span>
          )}

          <button
            onClick={() => setIntelOpen((v) => !v)}
            className={`h-7 px-2.5 rounded text-[11px] font-medium transition-colors border ${
              intelOpen
                ? "bg-bb-accent text-bb-bg-primary border-bb-accent"
                : "bg-bb-surface text-bb-text-secondary hover:text-bb-text-primary border-bb-border"
            }`}
            aria-pressed={intelOpen}
            title="Graph intelligence: PageRank, communities, shortest path, similarity"
          >
            Intel
          </button>
        </div>
      </header>

      {/* Main: full-viewport graph */}
      <div className="flex-1 relative min-h-0">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-bb-surface border border-bb-border flex items-center justify-center">
                <svg className="w-6 h-6 text-bb-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.965-.833-2.734 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-bb-text-primary text-sm font-medium mb-1">Graph unavailable</p>
              <p className="text-bb-text-muted text-xs leading-relaxed">
                Could not load graph data. Check your connection or try again later.
              </p>
            </div>
          </div>
        ) : !data ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-6 h-6 border-2 border-bb-border border-t-bb-accent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-bb-text-muted">Loading graph…</p>
            </div>
          </div>
        ) : filtered.nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <p className="text-bb-text-primary text-sm font-medium mb-1">No nodes match filter</p>
              <p className="text-bb-text-muted text-xs leading-relaxed">Try selecting a different category.</p>
            </div>
          </div>
        ) : (
          <BrainGalaxy
            nodes={filtered.nodes}
            edges={filtered.edges}
            onSelectNode={(slug) => {
              setSelectedId(slug);
              setSidebarOpen(true);
            }}
          />
        )}

        {/* Graph-intelligence panel — left side, doesn't fight the node detail sidebar */}
        {intelOpen && (
          <aside className="absolute inset-y-0 left-0 z-30 w-[88vw] max-w-sm bg-bb-bg-secondary border-r border-bb-border flex flex-col shadow-2xl">
            <button
              onClick={() => setIntelOpen(false)}
              aria-label="Close intel panel"
              className="absolute top-2 right-2 w-8 h-8 inline-flex items-center justify-center rounded-md text-bb-text-muted hover:text-bb-text-primary hover:bg-bb-surface transition-colors z-10"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <IntelPanel
              onSelectNode={(slug) => {
                setSelectedId(slug);
                setSidebarOpen(true);
              }}
            />
          </aside>
        )}

        {/* Node detail sidebar */}
        {sidebarOpen && selectedNode && (
          <>
            <button
              aria-label="Close details"
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-30 bg-black/40"
            />
            <aside className="fixed inset-y-0 right-0 z-40 w-[88vw] max-w-xs bg-bb-bg-secondary border-l border-bb-border flex flex-col animate-slide-in-right">
              <header className="shrink-0 h-12 px-4 flex items-center justify-between border-b border-bb-border">
                <span className="text-xs uppercase tracking-wider text-bb-text-muted">Node</span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-9 h-9 inline-flex items-center justify-center rounded-md text-bb-text-muted hover:text-bb-text-primary hover:bg-bb-surface transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </header>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-4">
                  <span className="text-[10px] uppercase tracking-wider text-bb-text-muted">{selectedNode.type}</span>
                  <h2 className="text-base font-semibold text-bb-text-primary mt-0.5">{selectedNode.label}</h2>
                  <p className="text-xs text-bb-accent font-mono mt-1">{selectedNode.id}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-bb-surface rounded-lg border border-bb-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-bb-text-muted mb-1">Links</div>
                    <div className="text-lg font-semibold text-bb-text-primary tabular-nums">{selectedNode.linkCount}</div>
                  </div>
                  <div className="bg-bb-surface rounded-lg border border-bb-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-bb-text-muted mb-1">Group</div>
                    <div className="text-lg font-semibold text-bb-text-primary tabular-nums">{selectedNode.group}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <Link
                    href={`/dashboard?page=${encodeURIComponent(selectedNode.id)}`}
                    className="inline-flex items-center gap-2 h-10 px-4 bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary text-sm font-medium rounded-lg transition-colors"
                  >
                    Open in dashboard
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                </div>
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
