"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import nextDynamic from "next/dynamic";
import { useUser, SignOutButton } from "@clerk/nextjs";
import type { GraphNode } from "@/lib/supabase/graph";
import DreamStatusCard from "@/components/DreamStatusCard";
import StatsBar from "@/components/dashboard/StatsBar";
import PageList from "@/components/dashboard/PageList";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import MembersCard from "@/components/dashboard/MembersCard";
import PageSidebar from "@/components/dashboard/PageSidebar";

const BrainGalaxy = nextDynamic(() => import("@/components/BrainGalaxy"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-6 h-6 border-2 border-bb-border border-t-bb-accent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-bb-text-muted">Loading 3D graph</p>
      </div>
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

  // Mobile side panel
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  // v0.3 — Collaboration
  const [brains, setBrains] = useState<Brain[]>([]);
  const [currentBrainId, setCurrentBrainId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [activityOpen, setActivityOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "offline">("offline");
  const sseRef = useRef<EventSource | null>(null);

  // Ask Your Brain — Skills Generator
  const [taskQuery, setTaskQuery] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskResult, setTaskResult] = useState<any | null>(null);

  // Slack Integration
  const [showSlackForm, setShowSlackForm] = useState(false);
  const [slackToken, setSlackToken] = useState("");
  const [slackTeamId, setSlackTeamId] = useState("");
  const [slackLoading, setSlackLoading] = useState(false);
  const [slackResult, setSlackResult] = useState<any | null>(null);

  const handleSlackConnect = useCallback(async () => {
    if (!slackToken || !slackTeamId) return;
    setSlackLoading(true);
    setSlackResult(null);
    try {
      const r = await fetch("/api/ingest/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: slackToken, teamId: slackTeamId }),
      });
      const data = await r.json();
      setSlackResult(data);
    } catch {
      setSlackResult({ error: "Failed to connect Slack" });
    } finally {
      setSlackLoading(false);
    }
  }, [slackToken, slackTeamId]);

  // Unwritten Rules
  const [implicitRules, setImplicitRules] = useState<any[]>([]);
  const [implicitRulesOpen, setImplicitRulesOpen] = useState(false);

  const handleTaskQuery = useCallback(async () => {
    if (!taskQuery.trim() || !currentBrainId) return;
    setTaskLoading(true);
    setTaskResult(null);
    try {
      const r = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: taskQuery.trim() }),
      });
      const data = await r.json();
      if (!data.error) {
        setTaskResult(data);
      } else {
        setTaskResult({ error: data.error });
      }
    } catch {
      setTaskResult({ error: "Failed to generate skills file" });
    } finally {
      setTaskLoading(false);
    }
  }, [taskQuery, currentBrainId]);

  // Fetch brains list
  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/brain/brains")
      .then((r) => r.json())
      .then((d) => {
        if (d.brains?.length > 0) {
          setBrains(d.brains);
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

    fetch(`/api/brain/implicit-rules${q}`)
      .then((r) => r.json())
      .then((d) => setImplicitRules(d.rules || []))
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

  const liveDot =
    liveStatus === "live"
      ? "bg-bb-accent"
      : liveStatus === "connecting"
      ? "bg-bb-warning animate-pulse"
      : "bg-bb-border-strong";

  return (
    <div className="h-[100dvh] flex flex-col bg-bb-bg-primary overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 h-12 md:h-14 flex items-center justify-between px-3 md:px-5 border-b border-bb-border bg-bb-bg-primary">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <a href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/brainbaseLogo.png" alt="Brainbase" width={22} height={22} className="rounded" priority />
            <span className="text-sm font-semibold tracking-tight text-bb-text-primary">brainbase</span>
          </a>
          <span className="hidden md:inline text-bb-border-strong">/</span>
          <span className="hidden md:inline text-xs text-bb-text-muted font-mono">dashboard</span>
        </div>

        <div className="flex items-center gap-1 md:gap-2 text-xs min-w-0">
          {/* Desktop nav links */}
          <a href="/docs" className="hidden md:inline-flex h-8 px-3 items-center text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-surface rounded transition-colors">Docs</a>
          <a href="/settings" className="hidden md:inline-flex h-8 px-3 items-center text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-surface rounded transition-colors">Settings</a>

          {isLoaded && user ? (
            <>
              {/* Brain switcher */}
              {brains.length > 1 && (
                <select
                  value={currentBrainId || ""}
                  onChange={(e) => handleSwitchBrain(e.target.value)}
                  className="hidden md:block bg-bb-surface border border-bb-border rounded px-2 h-8 text-xs text-bb-text-secondary outline-none hover:border-bb-border-hover focus:border-bb-accent transition-colors"
                >
                  {brains.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id.slice(0, 8)}… ({b.role})
                    </option>
                  ))}
                </select>
              )}

              {/* Live indicator */}
              <div className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded border border-bb-border bg-bb-surface">
                <span className={`w-1.5 h-1.5 rounded-full ${liveDot}`} title={liveStatus} />
                <span className="text-[10px] uppercase tracking-wider text-bb-text-muted">{liveStatus}</span>
              </div>

              {/* Username */}
              <span
                className="hidden lg:inline-block text-bb-text-secondary truncate max-w-[140px] font-mono"
                title={user.primaryEmailAddress?.emailAddress || ""}
              >
                {user.primaryEmailAddress?.emailAddress?.split("@")[0] || user.id.slice(0, 6)}
              </span>

              <SignOutButton>
                <button
                  className="hidden md:inline-flex h-8 px-3 items-center text-bb-text-muted hover:text-bb-text-primary hover:bg-bb-surface rounded transition-colors"
                  aria-label="Sign out"
                >
                  Sign out
                </button>
              </SignOutButton>

              {/* Mobile side panel toggle */}
              <button
                onClick={() => setMobilePanelOpen(true)}
                className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-surface transition-colors"
                aria-label="Open panel"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </>
          ) : (
            <a href="/sign-in" className="h-8 px-3 inline-flex items-center text-bb-accent hover:text-bb-accent-strong transition-colors">
              Sign in
            </a>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <StatsBar
            error={statsError}
            stats={[
              { label: "Pages", value: stats?.page_count, tone: "accent" },
              { label: "Links", value: stats?.link_count, tone: "muted" },
              { label: "People", value: pageTypes.person, tone: "danger" },
              { label: "Companies", value: pageTypes.company, tone: "info" },
              { label: "Projects", value: pageTypes.project, tone: "warning" },
              { label: "Score", value: stats?.brain_score, suffix: "/100", tone: "muted" },
            ]}
          />

          {/* Search */}
          <div className="shrink-0 px-4 md:px-6 pt-3">
            <div className="relative w-full md:max-w-xl">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bb-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Search pages, people, companies…"
                className={`w-full h-11 pl-9 pr-3 bg-bb-surface border rounded-lg text-sm text-bb-text-primary placeholder:text-bb-text-muted outline-none transition-colors ${
                  searchFocused ? "border-bb-accent" : "border-bb-border hover:border-bb-border-strong"
                }`}
              />
              <PageList
                results={results}
                onSelect={(slug) => {
                  handleSelectNode(slug);
                  setQuery("");
                  setResults([]);
                }}
              />
            </div>
          </div>

          {/* Ask Your Brain */}
          {isLoaded && user && (
            <div className="shrink-0 px-4 md:px-6 pt-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={taskQuery}
                  onChange={(e) => setTaskQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && taskQuery.trim()) handleTaskQuery(); }}
                  placeholder="Ask your brain, e.g. 'How do pricing exceptions work?'"
                  className="flex-1 h-11 px-3 bg-bb-surface border border-bb-border rounded-lg text-sm text-bb-text-primary placeholder:text-bb-text-muted outline-none hover:border-bb-border-strong focus:border-bb-accent transition-colors"
                />
                <button
                  onClick={handleTaskQuery}
                  disabled={!taskQuery.trim() || taskLoading}
                  className="h-11 px-4 bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 shrink-0"
                >
                  {taskLoading ? (
                    <span className="w-4 h-4 border-2 border-bb-bg-primary/30 border-t-bb-bg-primary rounded-full animate-spin" />
                  ) : (
                    "Generate"
                  )}
                </button>
              </div>
              {taskResult && (
                <div className="mt-2 rounded-lg bg-bb-surface border border-bb-border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-bb-border">
                    <span className="text-xs font-medium text-bb-accent">Skills file</span>
                    <span className="text-[10px] text-bb-text-muted tabular-nums">
                      confidence {Math.round((taskResult.confidence || 0) * 100)}%
                    </span>
                  </div>
                  <pre className="text-[11px] text-bb-text-secondary overflow-x-auto leading-relaxed p-3 max-h-48 font-mono">
                    <code>{JSON.stringify(taskResult, null, 2)}</code>
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Integrations */}
          {isLoaded && user && (
            <div className="shrink-0 px-4 md:px-6 pt-3">
              <div className="flex items-center flex-wrap gap-2 text-xs">
                <span className="text-bb-text-muted hidden md:inline uppercase tracking-wider text-[10px] font-medium">
                  Integrations
                </span>
                <button
                  onClick={() => setShowSlackForm(!showSlackForm)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 bg-bb-surface border border-bb-border rounded-md text-bb-text-secondary hover:text-bb-text-primary hover:border-bb-border-strong transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                  </svg>
                  Connect Slack
                </button>
                <span className="text-bb-text-muted">Gmail, Notion, Linear (soon)</span>
              </div>
              {showSlackForm && (
                <div className="mt-2 p-3 rounded-lg bg-bb-surface border border-bb-border">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="password"
                      value={slackToken}
                      onChange={(e) => setSlackToken(e.target.value)}
                      placeholder="Slack bot token (xoxb-...)"
                      className="flex-1 h-10 px-3 bg-bb-bg-primary border border-bb-border rounded-md text-xs text-bb-text-primary placeholder:text-bb-text-muted outline-none focus:border-bb-accent transition-colors"
                    />
                    <input
                      type="text"
                      value={slackTeamId}
                      onChange={(e) => setSlackTeamId(e.target.value)}
                      placeholder="Team ID"
                      className="sm:w-36 h-10 px-3 bg-bb-bg-primary border border-bb-border rounded-md text-xs text-bb-text-primary placeholder:text-bb-text-muted outline-none focus:border-bb-accent transition-colors"
                    />
                    <button
                      onClick={handleSlackConnect}
                      disabled={slackLoading || !slackToken || !slackTeamId}
                      className="h-10 px-4 bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary text-xs font-medium rounded-md transition-colors disabled:opacity-50 inline-flex items-center justify-center"
                    >
                      {slackLoading ? (
                        <span className="w-3.5 h-3.5 border-2 border-bb-bg-primary/30 border-t-bb-bg-primary rounded-full animate-spin" />
                      ) : (
                        "Ingest"
                      )}
                    </button>
                  </div>
                  {slackResult && (
                    <div className="mt-2 text-[11px] text-bb-text-secondary">
                      {slackResult.error ? (
                        <span className="text-bb-danger">{slackResult.error}</span>
                      ) : (
                        <span>
                          Fetched {slackResult.messages_fetched} messages, created {slackResult.pages_created} pages, {slackResult.decisions_detected} decisions.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* API key banner */}
          {isLoaded && user && (
            <div className="shrink-0 px-4 md:px-6 pt-3">
              <div className="flex items-center flex-wrap gap-2 text-xs">
                <span className="text-bb-text-muted uppercase tracking-wider text-[10px] font-medium">
                  API key
                </span>
                {apiKey ? (
                  <>
                    <code className="hidden sm:inline-flex items-center h-8 px-2 text-bb-text-secondary font-mono bg-bb-surface border border-bb-border rounded">
                      {showKey ? apiKey : apiKey.slice(0, 16) + "...···"}
                    </code>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(apiKey);
                          alert("API key copied to clipboard");
                        } catch {
                          alert("Could not copy. Visit Settings to see your full key.");
                        }
                      }}
                      className="sm:hidden inline-flex items-center gap-1.5 h-9 px-3 bg-bb-surface border border-bb-border rounded-md text-bb-text-secondary active:bg-bb-surface-hover transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="font-mono">{apiKey.slice(0, 10)}…</span>
                    </button>
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="hidden sm:inline-flex h-8 px-2 items-center text-bb-text-muted hover:text-bb-text-primary transition-colors"
                    >
                      {showKey ? "Hide" : "Show"}
                    </button>
                    <a href="/settings" className="text-bb-accent hover:text-bb-accent-strong transition-colors">
                      Manage →
                    </a>
                  </>
                ) : (
                  <a href="/settings" className="text-bb-accent hover:text-bb-accent-strong transition-colors">
                    Create API key →
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Dream status */}
          {isLoaded && user && (
            <div className="shrink-0 px-4 md:px-6 pt-3">
              <DreamStatusCard brainId={currentBrainId} />
            </div>
          )}

          {/* Graph */}
          <div className="flex-1 min-h-[320px] md:min-h-0 px-4 md:px-6 py-3 md:pb-6">
            <div className="h-full rounded-xl overflow-hidden border border-bb-border bg-bb-bg-secondary">
              {graphError ? (
                <GraphFallback
                  stats={stats}
                  onSelect={handleSelectNode}
                />
              ) : !graphData ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-bb-border border-t-bb-accent rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-bb-text-muted">Loading graph</p>
                  </div>
                </div>
              ) : graphData.nodes.length === 0 ? (
                <div className="h-full flex items-center justify-center p-6">
                  <div className="text-center max-w-sm">
                    <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-bb-surface border border-bb-border flex items-center justify-center">
                      <svg className="w-6 h-6 text-bb-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <p className="text-bb-text-primary text-sm font-medium mb-1">No graph data yet</p>
                    <p className="text-bb-text-muted text-xs leading-relaxed">
                      Import contacts or connect Slack to build your brain.
                    </p>
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

        {/* Right panel: activity + members (desktop) */}
        <aside className="hidden md:flex shrink-0 w-72 border-l border-bb-border bg-bb-bg-secondary flex-col">
          <ActivityFeed
            activities={activities}
            open={activityOpen}
            onToggle={() => setActivityOpen(!activityOpen)}
            onSelect={handleSelectNode}
          />
          <section className="shrink-0 border-b border-bb-border flex flex-col">
            <button
              onClick={() => setImplicitRulesOpen(!implicitRulesOpen)}
              className="shrink-0 h-11 px-4 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-bb-text-secondary hover:text-bb-text-primary transition-colors"
            >
              <span className="flex items-center gap-2">
                Unwritten rules
                {implicitRules.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-bb-surface border border-bb-border text-[10px] text-bb-text-muted tabular-nums normal-case tracking-normal">
                    {implicitRules.length}
                  </span>
                )}
              </span>
              <svg className={`w-4 h-4 transition-transform ${implicitRulesOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {implicitRulesOpen && (
              <div className="px-4 pb-4 max-h-56 overflow-y-auto space-y-px">
                {implicitRules.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-xs text-bb-text-secondary">None detected yet</p>
                    <p className="text-[11px] text-bb-text-muted mt-1">Add more timeline entries and decisions.</p>
                  </div>
                ) : (
                  implicitRules.map((r, i) => (
                    <div key={i} className="text-xs py-2 border-b border-bb-border last:border-0">
                      <p className="text-bb-text-secondary leading-relaxed">{r.observation}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-bb-text-muted tabular-nums">
                          {Math.round(r.confidence * 100)}% confidence
                        </span>
                        <button
                          onClick={() => handleSelectNode(r.page_slug)}
                          className="text-[10px] text-bb-accent hover:text-bb-accent-strong truncate max-w-[120px]"
                        >
                          {r.page_title}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
          <MembersCard
            members={members}
            invites={invites}
            open={membersOpen}
            onToggle={() => setMembersOpen(!membersOpen)}
          />
        </aside>

        {/* Mobile side panel drawer */}
        {mobilePanelOpen && (
          <>
            <button
              aria-label="Close panel"
              onClick={() => setMobilePanelOpen(false)}
              className="md:hidden fixed inset-0 z-40 bg-black/60"
            />
            <aside className="md:hidden fixed inset-y-0 right-0 z-50 w-[90vw] max-w-sm bg-bb-bg-secondary border-l border-bb-border flex flex-col animate-slide-in-right">
              <header className="shrink-0 h-12 px-4 flex items-center justify-between border-b border-bb-border">
                <span className="text-xs uppercase tracking-wider text-bb-text-muted">Panel</span>
                <button
                  onClick={() => setMobilePanelOpen(false)}
                  aria-label="Close"
                  className="w-9 h-9 inline-flex items-center justify-center rounded-md text-bb-text-muted hover:text-bb-text-primary hover:bg-bb-surface transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </header>
              <div className="flex-1 overflow-y-auto flex flex-col">
                <ActivityFeed
                  activities={activities}
                  open={activityOpen}
                  onToggle={() => setActivityOpen(!activityOpen)}
                  onSelect={(slug) => {
                    setMobilePanelOpen(false);
                    handleSelectNode(slug);
                  }}
                />
                <MembersCard
                  members={members}
                  invites={invites}
                  open={membersOpen}
                  onToggle={() => setMembersOpen(!membersOpen)}
                />
              </div>
            </aside>
          </>
        )}

        {/* Selected page sidebar */}
        <PageSidebar
          page={selectedPage}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSelect={handleSelectNode}
        />
      </div>
    </div>
  );
}

// Graph fallback: flat list of most-connected pages
function GraphFallback({
  stats,
  onSelect,
}: {
  stats: BrainStats | null;
  onSelect: (slug: string) => void;
}) {
  const connected = stats?.most_connected || [];
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-bb-surface border border-bb-border flex items-center justify-center">
            <svg className="w-6 h-6 text-bb-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-bb-text-primary font-medium mb-1">3D graph unavailable</p>
          <p className="text-xs text-bb-text-muted leading-relaxed">
            Showing most connected pages. Use the CLI or MCP endpoint to query directly.
          </p>
          <code className="inline-block mt-3 px-2.5 py-1.5 text-[11px] text-bb-accent font-mono bg-bb-surface border border-bb-border rounded">
            brainbase query &quot;anything&quot;
          </code>
        </div>
        {connected.length > 0 && (
          <ul className="space-y-px border border-bb-border rounded-lg bg-bb-bg-primary overflow-hidden">
            {connected.map((p) => (
              <li key={p.slug}>
                <button
                  onClick={() => onSelect(p.slug)}
                  className="w-full text-left px-4 py-3 hover:bg-bb-surface transition-colors flex items-center justify-between gap-3 border-b border-bb-border last:border-0"
                >
                  <span className="text-sm text-bb-text-primary truncate">{p.title}</span>
                  <span className="text-xs text-bb-text-muted tabular-nums shrink-0">
                    {p.link_count} links
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
