"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useUser, SignOutButton } from "@clerk/nextjs";
import type { GraphNode } from "@/lib/supabase/graph";

const BrainGalaxy = dynamic(() => import("@/components/BrainGalaxy"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <span className="text-sm text-bb-text-muted">Loading 3D graph...</span>
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

interface Brain {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface Activity {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_slug: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface Member {
  user_id: string;
  role: string;
  created_at: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  page_created: "created page",
  page_updated: "updated page",
  page_deleted: "deleted page",
  link_created: "added link",
  link_deleted: "removed link",
  timeline_added: "added timeline entry",
  member_joined: "joined brain",
  invite_sent: "sent invite",
};

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

  // v0.3 — Collaboration
  const [brains, setBrains] = useState<Brain[]>([]);
  const [currentBrainId, setCurrentBrainId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "offline">("offline");
  const sseRef = useRef<EventSource | null>(null);

  // Fetch brains list
  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/brain/brains")
      .then((r) => r.json())
      .then((d) => {
        if (d.brains?.length > 0) {
          setBrains(d.brains);
          // Default to first (usually owned)
          const first = d.brains[0];
          setCurrentBrainId(first.id);
        }
      })
      .catch(() => {});
  }, [isLoaded, user]);

  // Fetch stats + graph for current brain
  useEffect(() => {
    if (!currentBrainId) return;
    const q = currentBrainId ? `?brain_id=${currentBrainId}` : "";

    fetch(`/api/brain/health${q}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setStats(d); setStatsError(false); })
      .catch(() => setStatsError(true));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    fetch(`/api/brain/graph${q}`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { clearTimeout(timeout); setGraphData(d); setGraphError(false); })
      .catch(() => { clearTimeout(timeout); setGraphError(true); });

    fetch(`/api/brain/activity${q}`)
      .then((r) => r.json())
      .then((d) => setActivities(d.activities || []))
      .catch(() => {});

    fetch(`/api/brain/share${q}`)
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.members || []);
        setInvites(d.invites || []);
      })
      .catch(() => {});

    return () => { clearTimeout(timeout); controller.abort(); };
  }, [currentBrainId]);

  // SSE live updates
  useEffect(() => {
    if (!currentBrainId) return;
    const es = new EventSource(`/api/brain/live?brain_id=${currentBrainId}`);
    sseRef.current = es;
    setLiveStatus("connecting");

    es.addEventListener("connected", () => setLiveStatus("live"));
    es.addEventListener("ping", () => setLiveStatus("live"));
    es.addEventListener("error", () => setLiveStatus("offline"));

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [currentBrainId]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/keys")
      .then((r) => r.json())
      .then((d) => {
        if (d.keys?.length > 0) {
          setApiKey(d.keys[0].key_prefix + "...···");
        }
      })
      .catch(() => {});
  }, [isLoaded, user]);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(() => {
      fetch(`/api/brain/search?q=${encodeURIComponent(q)}${currentBrainId ? `&brain_id=${currentBrainId}` : ""}`)
        .then((r) => r.json())
        .then((d) => setResults(Array.isArray(d) ? d : []))
        .catch(() => {});
    }, 200);
  }, [currentBrainId]);

  const handleSelectNode = useCallback(async (slug: string) => {
    try {
      const r = await fetch(`/api/brain/page/${encodeURIComponent(slug)}${currentBrainId ? `?brain_id=${currentBrainId}` : ""}`);
      if (!r.ok) return;
      const page = await r.json();
      setSelectedPage(page);
      setSidebarOpen(true);
    } catch { }
  }, [currentBrainId]);

  const handleSwitchBrain = (brainId: string) => {
    setCurrentBrainId(brainId);
    setSelectedPage(null);
    setSidebarOpen(false);
    setGraphData(null);
  };

  const pageTypes = stats?.pages_by_type || {};

  return (
    <div className="h-screen flex flex-col bg-bb-bg-primary overflow-hidden">
      {/* Nav */}
      <header className="shrink-0 h-12 flex items-center justify-between px-6 border-b border-bb-border">
        <div className="flex items-center gap-3">
          <Image src="/brainbaseLogo.png" alt="Brainbase" width={24} height={24} className="rounded" priority />
          <span className="text-sm font-medium text-bb-text-primary tracking-tight">brainbase</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-bb-text-muted">
          <a href="/" className="hover:text-bb-text-secondary transition-colors">Home</a>
          <a href="/docs" className="hover:text-bb-text-secondary transition-colors">Docs</a>
          {isLoaded && user ? (
            <>
              <a href="/dashboard/settings" className="hover:text-bb-text-secondary transition-colors">Settings</a>
              <span className="font-mono text-bb-border">|</span>
              {/* Brain Switcher */}
              {brains.length > 1 && (
                <select
                  value={currentBrainId || ""}
                  onChange={(e) => handleSwitchBrain(e.target.value)}
                  className="bg-bb-bg-secondary border border-bb-border rounded px-2 py-1 text-xs text-bb-text-secondary outline-none focus:border-bb-border-hover"
                >
                  {brains.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id.slice(0, 8)}… ({b.role})
                    </option>
                  ))}
                </select>
              )}
              {/* Live indicator */}
              <span className={`w-2 h-2 rounded-full ${liveStatus === "live" ? "bg-emerald-400" : liveStatus === "connecting" ? "bg-amber-400 animate-pulse" : "bg-bb-border"}`} title={liveStatus} />
              <span className="text-bb-text-secondary">{user.primaryEmailAddress?.emailAddress?.split("@")[0] || user.id.slice(0, 6)}</span>
              <SignOutButton>
                <button className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Sign out</button>
              </SignOutButton>
            </>
          ) : (
            <a href="/sign-in" className="text-bb-accent hover:text-bb-accent-dim transition-colors">Sign in</a>
          )}
          <span className="font-mono text-bb-border">|</span>
          <span className="font-mono text-bb-accent text-[11px]">MCP: /api/mcp</span>
          {statsError ? (
            <span className="text-red-400">API offline</span>
          ) : (
            <span className="text-bb-text-muted">{stats?.page_count ?? "—"} pages</span>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Stats bar */}
          <div className="shrink-0 px-6 py-4 flex items-center gap-4 border-b border-bb-border overflow-x-auto">
            {[
              { label: "Pages", value: stats?.page_count, color: "text-bb-accent" },
              { label: "Links", value: stats?.link_count, color: "text-bb-accent-dim" },
              { label: "People", value: pageTypes.person, color: "text-rose-400" },
              { label: "Companies", value: pageTypes.company, color: "text-sky-400" },
              { label: "Projects", value: pageTypes.project, color: "text-amber-400" },
              { label: "Score", value: stats?.brain_score, suffix: "/100", color: "text-bb-text-secondary" },
            ].map((s) => (
              <div key={s.label} className="flex items-baseline gap-2 shrink-0">
                <span className="text-bb-text-muted text-xs uppercase tracking-wide font-medium">{s.label}</span>
                <span className={`text-lg font-bold tabular-nums ${s.color}`}>
                  {s.value ?? "—"}{s.suffix || ""}
                </span>
              </div>
            ))}
            {statsError && <span className="text-xs text-red-400">Stats unavailable — API may be down</span>}
          </div>

          {/* Search */}
          <div className="shrink-0 px-6 py-3">
            <div className={`relative max-w-lg ${searchFocused ? "ring-1 ring-bb-border-hover rounded-lg" : ""}`}>
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Search your brain..."
                className="w-full bg-bb-bg-secondary border border-bb-border rounded-lg px-3 py-2 text-sm text-bb-text-secondary placeholder:text-bb-text-muted outline-none focus:border-bb-border-hover"
              />
              {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-72 overflow-y-auto bg-bb-bg-secondary border border-bb-border rounded-lg shadow-2xl">
                  {results.map((r) => (
                    <button
                      key={r.slug}
                      onClick={() => { handleSelectNode(r.slug); setQuery(""); setResults([]); }}
                      className="w-full text-left px-4 py-3 hover:bg-bb-bg-tertiary transition-colors border-b border-bb-border last:border-0"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono uppercase text-bb-text-muted">{r.type}</span>
                        <span className="text-[10px] text-bb-text-muted">{Math.round(r.score * 100)}%</span>
                      </div>
                      <span className="text-sm font-medium text-bb-text-primary">{r.title}</span>
                      {r.excerpt && <p className="text-xs text-bb-text-muted mt-0.5 line-clamp-1">{r.excerpt}</p>}
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
                <span className="text-bb-text-muted">API key:</span>
                {apiKey ? (
                  <>
                    <code className="text-bb-text-secondary font-mono bg-bb-bg-secondary px-2 py-1 rounded border border-bb-border">{showKey ? apiKey : apiKey.slice(0, 16) + "...···"}</code>
                    <button onClick={() => setShowKey(!showKey)} className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">
                      {showKey ? "Hide" : "Show"}
                    </button>
                    <a href="/dashboard/settings" className="text-bb-accent hover:text-bb-accent-dim transition-colors">Manage keys →</a>
                  </>
                ) : (
                  <a href="/dashboard/settings" className="text-bb-accent hover:text-bb-accent-dim transition-colors">Create API key →</a>
                )}
              </div>
            </div>
          )}

          {/* 3D Graph or Fallback */}
          <div className="flex-1 min-h-0 px-6 pb-6">
            <div className="h-full rounded-xl overflow-hidden border border-bb-border bg-bb-bg-secondary">
              {graphError ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-bb-text-secondary text-sm mb-2">3D graph unavailable</p>
                    <p className="text-bb-text-muted text-xs">Use the CLI or MCP endpoint to query the brain directly.</p>
                    <code className="text-xs text-bb-accent mt-2 block font-mono">brainbase query &quot;anything&quot;</code>
                  </div>
                </div>
              ) : !graphData ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-bb-border border-t-bb-text-muted rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-bb-text-muted">Loading graph...</p>
                  </div>
                </div>
              ) : graphData.nodes.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-bb-text-secondary text-sm mb-2">No graph data</p>
                    <p className="text-bb-text-muted text-xs">Import contacts or add pages to build your graph.</p>
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

        {/* Right panels */}
        <div className="shrink-0 w-72 border-l border-bb-border bg-bb-bg-secondary/90 backdrop-blur flex flex-col">
          {/* Activity Feed */}
          <div className="flex-1 min-h-0 flex flex-col border-b border-bb-border">
            <button
              onClick={() => setActivityOpen(!activityOpen)}
              className="shrink-0 px-4 py-3 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-bb-text-muted hover:text-bb-text-secondary transition-colors"
            >
              <span>Activity</span>
              <span>{activityOpen ? "−" : "+"}</span>
            </button>
            {activityOpen && (
              <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2">
                {activities.length === 0 ? (
                  <p className="text-xs text-bb-text-muted">No recent activity.</p>
                ) : (
                  activities.map((a) => (
                    <div key={a.id} className="text-xs py-1.5 border-b border-bb-border/50 last:border-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-bb-accent">{actionLabels[a.action] || a.action}</span>
                        {a.entity_slug && (
                          <button
                            onClick={() => a.entity_slug && handleSelectNode(a.entity_slug)}
                            className="text-bb-text-secondary hover:text-bb-text-primary truncate max-w-[120px]"
                          >
                            {a.entity_slug}
                          </button>
                        )}
                      </div>
                      <div className="text-bb-text-muted mt-0.5">
                        {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Members */}
          <div className="shrink-0 max-h-48 flex flex-col">
            <button
              onClick={() => setMembersOpen(!membersOpen)}
              className="shrink-0 px-4 py-3 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-bb-text-muted hover:text-bb-text-secondary transition-colors"
            >
              <span>Members ({members.length + 1})</span>
              <span>{membersOpen ? "−" : "+"}</span>
            </button>
            {membersOpen && (
              <div className="overflow-y-auto px-4 pb-3 space-y-1.5">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between text-xs">
                    <span className="text-bb-text-secondary truncate">{m.user_id.slice(0, 12)}…</span>
                    <span className="text-bb-text-muted uppercase text-[10px]">{m.role}</span>
                  </div>
                ))}
                {invites.length > 0 && (
                  <div className="pt-1 border-t border-bb-border/50">
                    <span className="text-[10px] text-bb-text-muted uppercase">Pending</span>
                    {invites.map((i) => (
                      <div key={i.id} className="flex items-center justify-between text-xs mt-1">
                        <span className="text-bb-text-muted truncate">{i.email}</span>
                        <span className="text-bb-text-muted uppercase text-[10px]">{i.role}</span>
                      </div>
                    ))}
                  </div>
                )}
                <a
                  href="/dashboard/settings"
                  className="block text-center text-[10px] text-bb-accent hover:text-bb-accent-dim pt-1"
                >
                  Manage sharing →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Page Sidebar */}
        <div className={`shrink-0 border-l border-bb-border bg-bb-bg-secondary/90 backdrop-blur transition-all duration-300 overflow-hidden ${sidebarOpen && selectedPage ? "w-96" : "w-0"}`}>
          {sidebarOpen && selectedPage && (
            <div className="w-96 h-full flex flex-col">
              <div className="shrink-0 px-5 py-4 flex items-start justify-between border-b border-bb-border">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-bb-accent">{selectedPage.type}</span>
                  <h2 className="text-base font-semibold text-bb-text-primary mt-1">{selectedPage.title}</h2>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-bb-text-muted hover:text-bb-text-secondary text-lg leading-none shrink-0 ml-3">×</button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {selectedPage.links && (selectedPage.links.outgoing.length > 0 || selectedPage.links.incoming.length > 0) && (
                  <div className="mb-4">
                    <h3 className="text-xs font-medium text-bb-text-muted uppercase tracking-wider mb-2">Links</h3>
                    {selectedPage.links.outgoing.slice(0, 8).map((l) => (
                      <button key={l.slug + l.link_type} onClick={() => handleSelectNode(l.slug)}
                        className="block w-full text-left text-xs py-1.5 px-2 rounded hover:bg-bb-bg-tertiary transition-colors group">
                        <span className="text-bb-text-secondary group-hover:text-bb-text-primary">{l.title}</span>
                        <span className="text-bb-text-muted ml-2 font-mono">{l.link_type}</span>
                      </button>
                    ))}
                    {selectedPage.links.incoming.slice(0, 4).map((l) => (
                      <button key={l.slug + l.link_type} onClick={() => handleSelectNode(l.slug)}
                        className="block w-full text-left text-xs py-1.5 px-2 rounded hover:bg-bb-bg-tertiary transition-colors group">
                        <span className="text-bb-text-muted group-hover:text-bb-text-secondary">← {l.title}</span>
                        <span className="text-bb-text-muted ml-2 font-mono">{l.link_type}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="text-sm text-bb-text-secondary leading-relaxed whitespace-pre-wrap">
                  {selectedPage.content || <span className="text-bb-text-muted">No content</span>}
                </div>
                {selectedPage.timeline && selectedPage.timeline.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-bb-border">
                    <h3 className="text-xs font-medium text-bb-text-muted uppercase tracking-wider mb-2">Timeline</h3>
                    {selectedPage.timeline.map((t, i) => (
                      <div key={i} className="text-xs mb-2 pl-2 border-l border-bb-border">
                        <span className="text-bb-text-muted font-mono">{t.date}</span>
                        <p className="text-bb-text-secondary mt-0.5">{t.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 px-5 py-3 border-t border-bb-border">
                <code className="text-[10px] text-bb-text-muted font-mono">{selectedPage.slug}</code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
