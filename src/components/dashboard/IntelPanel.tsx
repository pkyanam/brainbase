"use client";

import { useState } from "react";

type Tab = "pagerank" | "communities" | "shortest" | "similar";

interface PageRankRow {
  slug: string;
  title: string;
  type: string;
  score: number;
}

interface CommunityRow {
  slug: string;
  title: string;
  type: string;
  community_id: number;
}

interface SimilarityRow {
  slug: string;
  title: string;
  type: string;
  similarity: number;
}

interface ShortestPathHop {
  slug: string;
  title: string;
  type: string;
  link_type?: string | null;
}

/**
 * Graph-intelligence side panel — surfaces PageRank, Louvain communities,
 * shortest-path search, and structural similarity. Calls the
 * /api/brain/intel/* routes.
 *
 * Renders inline (no portal). The host (GraphClient) controls visibility.
 */
export default function IntelPanel({ onSelectNode }: { onSelectNode?: (slug: string) => void }) {
  const [tab, setTab] = useState<Tab>("pagerank");

  return (
    <div className="flex flex-col h-full text-sm">
      <header className="shrink-0 border-b border-bb-border">
        <div className="px-4 pt-4 pb-2 flex items-baseline justify-between">
          <h3 className="text-xs uppercase tracking-wider text-bb-text-muted">Graph intelligence</h3>
          <span className="text-[10px] text-bb-text-muted/70">Neo4j</span>
        </div>
        <nav className="flex gap-0 px-2 pb-2 overflow-x-auto">
          {(
            [
              ["pagerank", "PageRank"],
              ["communities", "Communities"],
              ["shortest", "Shortest path"],
              ["similar", "Similar"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                tab === key
                  ? "bg-bb-surface text-bb-text-primary"
                  : "text-bb-text-muted hover:text-bb-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === "pagerank" && <PageRankTab onSelectNode={onSelectNode} />}
        {tab === "communities" && <CommunitiesTab onSelectNode={onSelectNode} />}
        {tab === "shortest" && <ShortestPathTab onSelectNode={onSelectNode} />}
        {tab === "similar" && <SimilarTab onSelectNode={onSelectNode} />}
      </div>
    </div>
  );
}

// ── PageRank tab ─────────────────────────────────────────────

function PageRankTab({ onSelectNode }: { onSelectNode?: (slug: string) => void }) {
  const [rows, setRows] = useState<PageRankRow[] | null>(null);
  const [meta, setMeta] = useState<{ algorithm: string; reason?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/brain/intel/pagerank?limit=25");
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      setRows(j.results || []);
      setMeta({ algorithm: j.algorithm, reason: j.reason });
    } catch (e: any) {
      setError(e?.message || "failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-bb-text-muted">Top-N most central pages.</p>
        <button
          onClick={run}
          disabled={loading}
          className="h-8 px-3 text-xs rounded-md bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary disabled:opacity-50"
        >
          {loading ? "…" : rows ? "Refresh" : "Run"}
        </button>
      </div>
      {meta?.reason ? (
        <div className="text-[11px] text-bb-text-muted/80 bg-bb-surface rounded-md px-2 py-1.5 border border-bb-border">
          {meta.reason}
        </div>
      ) : null}
      {error ? <ErrorBlock message={error} /> : null}
      {rows && rows.length === 0 ? <p className="text-xs text-bb-text-muted">No results.</p> : null}
      {rows && rows.length > 0 ? (
        <ol className="space-y-1">
          {rows.map((r, i) => (
            <li key={r.slug} className="flex items-center gap-2">
              <span className="w-6 text-xs text-bb-text-muted tabular-nums">{i + 1}.</span>
              <SlugLink slug={r.slug} title={r.title} onSelectNode={onSelectNode} />
              <span className="ml-auto font-mono text-xs text-bb-text-muted tabular-nums">
                {r.score.toFixed(3)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

// ── Communities tab ──────────────────────────────────────────

function CommunitiesTab({ onSelectNode }: { onSelectNode?: (slug: string) => void }) {
  const [rows, setRows] = useState<CommunityRow[] | null>(null);
  const [count, setCount] = useState(0);
  const [available, setAvailable] = useState(true);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/brain/intel/communities?limit=500");
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      setAvailable(!!j.available);
      setReason(j.reason ?? null);
      setRows(j.results || []);
      setCount(j.community_count || 0);
    } catch (e: any) {
      setError(e?.message || "failed");
    } finally {
      setLoading(false);
    }
  }

  const grouped = (rows ?? []).reduce<Map<number, CommunityRow[]>>((acc, r) => {
    const list = acc.get(r.community_id) ?? [];
    list.push(r);
    acc.set(r.community_id, list);
    return acc;
  }, new Map());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-bb-text-muted">
          Natural clusters via Louvain.
          {rows ? <span className="ml-1 text-bb-text-primary">{count} found.</span> : null}
        </p>
        <button
          onClick={run}
          disabled={loading}
          className="h-8 px-3 text-xs rounded-md bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary disabled:opacity-50"
        >
          {loading ? "…" : rows ? "Refresh" : "Run"}
        </button>
      </div>
      {!available && reason ? <ErrorBlock message={reason} /> : null}
      {error ? <ErrorBlock message={error} /> : null}
      {available && rows && rows.length === 0 ? (
        <p className="text-xs text-bb-text-muted">No communities yet.</p>
      ) : null}
      {available && rows && rows.length > 0 ? (
        <div className="space-y-3">
          {Array.from(grouped.entries())
            .sort((a, b) => b[1].length - a[1].length)
            .map(([id, members]) => (
              <div key={id} className="border border-bb-border rounded-md p-2 bg-bb-surface">
                <div className="text-[10px] uppercase tracking-wider text-bb-text-muted mb-1">
                  Community {id} · {members.length}
                </div>
                <ul className="space-y-0.5">
                  {members.slice(0, 8).map((m) => (
                    <li key={m.slug}>
                      <SlugLink slug={m.slug} title={m.title} onSelectNode={onSelectNode} />
                    </li>
                  ))}
                  {members.length > 8 ? (
                    <li className="text-xs text-bb-text-muted">+ {members.length - 8} more</li>
                  ) : null}
                </ul>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Shortest path tab ────────────────────────────────────────

function ShortestPathTab({ onSelectNode }: { onSelectNode?: (slug: string) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hops, setHops] = useState<ShortestPathHop[] | null>(null);
  const [length, setLength] = useState(0);
  const [found, setFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    setHops(null);
    try {
      const url = `/api/brain/intel/shortest-path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      setFound(!!j.found);
      setLength(j.length || 0);
      setHops(j.hops || []);
    } catch (e: any) {
      setError(e?.message || "failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-bb-text-muted">Find the chain of links connecting two pages.</p>
      <div className="space-y-2">
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="from slug (e.g. people/garry-tan)"
          className="w-full h-9 px-3 text-xs bg-bb-surface border border-bb-border rounded-md focus:outline-none focus:ring-1 focus:ring-bb-accent"
        />
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="to slug (e.g. companies/yc)"
          className="w-full h-9 px-3 text-xs bg-bb-surface border border-bb-border rounded-md focus:outline-none focus:ring-1 focus:ring-bb-accent"
        />
        <button
          onClick={run}
          disabled={loading || !from || !to}
          className="w-full h-8 text-xs rounded-md bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary disabled:opacity-50"
        >
          {loading ? "Searching…" : "Find path"}
        </button>
      </div>
      {error ? <ErrorBlock message={error} /> : null}
      {hops && !found ? (
        <p className="text-xs text-bb-text-muted">No path found within 6 hops.</p>
      ) : null}
      {hops && found ? (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-bb-text-muted">
            Path · {length} hops
          </div>
          <ol className="space-y-0.5">
            {hops.map((h, i) => (
              <li key={`${h.slug}-${i}`} className="flex items-center gap-2">
                <span className="text-xs text-bb-text-muted tabular-nums w-5">{i}</span>
                <SlugLink slug={h.slug} title={h.title} onSelectNode={onSelectNode} />
                {h.link_type && i > 0 ? (
                  <span className="text-[10px] text-bb-text-muted font-mono">{h.link_type}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

// ── Similar pages tab ────────────────────────────────────────

function SimilarTab({ onSelectNode }: { onSelectNode?: (slug: string) => void }) {
  const [slug, setSlug] = useState("");
  const [rows, setRows] = useState<SimilarityRow[] | null>(null);
  const [meta, setMeta] = useState<{ algorithm: string; reason?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/brain/intel/similar?slug=${encodeURIComponent(slug)}&limit=10`);
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      setRows(j.results || []);
      setMeta({ algorithm: j.algorithm, reason: j.reason });
    } catch (e: any) {
      setError(e?.message || "failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-bb-text-muted">Pages with the most overlapping neighbors.</p>
      <div className="flex gap-2">
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="slug (e.g. people/garry-tan)"
          className="flex-1 h-9 px-3 text-xs bg-bb-surface border border-bb-border rounded-md focus:outline-none focus:ring-1 focus:ring-bb-accent"
        />
        <button
          onClick={run}
          disabled={loading || !slug}
          className="h-9 px-3 text-xs rounded-md bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary disabled:opacity-50"
        >
          {loading ? "…" : "Find"}
        </button>
      </div>
      {meta?.reason ? (
        <div className="text-[11px] text-bb-text-muted/80 bg-bb-surface rounded-md px-2 py-1.5 border border-bb-border">
          {meta.reason}
        </div>
      ) : null}
      {error ? <ErrorBlock message={error} /> : null}
      {rows && rows.length === 0 ? (
        <p className="text-xs text-bb-text-muted">No similar pages found.</p>
      ) : null}
      {rows && rows.length > 0 ? (
        <ol className="space-y-1">
          {rows.map((r, i) => (
            <li key={r.slug} className="flex items-center gap-2">
              <span className="w-6 text-xs text-bb-text-muted tabular-nums">{i + 1}.</span>
              <SlugLink slug={r.slug} title={r.title} onSelectNode={onSelectNode} />
              <span className="ml-auto font-mono text-xs text-bb-text-muted tabular-nums">
                {r.similarity.toFixed(3)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────

function SlugLink({
  slug,
  title,
  onSelectNode,
}: {
  slug: string;
  title: string;
  onSelectNode?: (slug: string) => void;
}) {
  if (onSelectNode) {
    return (
      <button
        onClick={() => onSelectNode(slug)}
        className="text-bb-text-primary hover:text-bb-accent text-left text-xs truncate"
        title={slug}
      >
        {title || slug}
      </button>
    );
  }
  return (
    <a
      href={`/dashboard?page=${encodeURIComponent(slug)}`}
      className="text-bb-text-primary hover:text-bb-accent text-xs truncate"
      title={slug}
    >
      {title || slug}
    </a>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="text-[11px] text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-2 py-1.5">
      {message}
    </div>
  );
}
