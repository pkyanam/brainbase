"use client";

import { useEffect, useState } from "react";

interface WikiState {
  brain_id: string;
  slug: string;
  name: string;
  wiki: {
    enabled: boolean;
    title: string | null;
    tagline: string | null;
    public_url: string | null;
  };
  counts: { public: number; total: number };
}

/**
 * Wiki settings card — lives in /settings.
 *
 * Owner toggles `brain.wiki_enabled` here. The per-page `public` flag is
 * managed elsewhere (page editor / page list). Both gates must be on for a
 * page to appear at /b/<slug>/<page>.
 */
export default function WikiSettingsCard() {
  const [state, setState] = useState<WikiState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/brain/wiki");
      if (!r.ok) throw new Error(`${r.status}`);
      const j = (await r.json()) as WikiState;
      setState(j);
      setTitle(j.wiki.title || "");
      setTagline(j.wiki.tagline || "");
    } catch (e: any) {
      setError(e?.message || "failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function update(patch: Partial<{ enabled: boolean; title: string; tagline: string }>) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/brain/wiki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      await refresh();
    } catch (e: any) {
      setError(e?.message || "failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !state) {
    return (
      <section className="bg-bb-surface border border-bb-border rounded-xl p-6">
        <h2 className="text-sm uppercase tracking-wider text-bb-text-muted mb-2">Public wiki</h2>
        <p className="text-sm text-bb-text-muted">Loading…</p>
      </section>
    );
  }
  if (!state) return null;

  const enabled = state.wiki.enabled;
  const wikiUrl = state.wiki.public_url
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${state.wiki.public_url}`
    : null;

  return (
    <section className="bg-bb-surface border border-bb-border rounded-xl p-6 space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm uppercase tracking-wider text-bb-text-muted">Public wiki</h2>
          <p className="text-xs text-bb-text-muted/80 mt-1">
            Publish selected pages as a Wikipedia-style read-only site. {state.counts.public} of {state.counts.total} pages flagged public.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="w-4 h-4 accent-bb-accent"
          />
          <span className="text-xs text-bb-text-primary">{enabled ? "Enabled" : "Disabled"}</span>
        </label>
      </header>

      {wikiUrl ? (
        <div className="text-xs">
          <span className="text-bb-text-muted">Public URL:</span>{" "}
          <a
            href={wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-bb-accent font-mono break-all"
          >
            {wikiUrl}
          </a>
        </div>
      ) : null}

      {error ? (
        <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-2 py-1.5">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-xs text-bb-text-muted mb-1">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title !== (state.wiki.title || "")) update({ title });
            }}
            placeholder={state.name}
            className="w-full h-9 px-3 text-sm bg-bb-bg-primary border border-bb-border rounded-md focus:outline-none focus:ring-1 focus:ring-bb-accent"
            disabled={saving || !enabled}
          />
        </label>
        <label className="block">
          <span className="block text-xs text-bb-text-muted mb-1">Tagline</span>
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            onBlur={() => {
              if (tagline !== (state.wiki.tagline || "")) update({ tagline });
            }}
            placeholder="A one-line description"
            className="w-full h-9 px-3 text-sm bg-bb-bg-primary border border-bb-border rounded-md focus:outline-none focus:ring-1 focus:ring-bb-accent"
            disabled={saving || !enabled}
          />
        </label>
      </div>

      <p className="text-xs text-bb-text-muted/70">
        To publish a page, flip its <code className="text-bb-text-primary">public</code> flag from the page editor.
        Both the wiki and the page must be public.
      </p>
    </section>
  );
}
