"use client";

import { useEffect, useState } from "react";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  description: string | null;
  last_delivery_at: string | null;
  last_delivery_status: number | null;
  last_delivery_error: string | null;
  delivery_count: number;
  failure_count: number;
  created_at: string;
}

const ALL_EVENTS = [
  "page.created",
  "page.updated",
  "page.deleted",
  "link.created",
  "link.deleted",
  "timeline.created",
  "dream.completed",
];

/**
 * Webhooks card — owner-only. Lets the user subscribe an external URL to
 * brain events. Secrets are shown ONCE on creation.
 */
export default function WebhooksCard() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<Set<string>>(new Set(["*"]));
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string } | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/brain/webhooks");
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      setWebhooks(j.webhooks || []);
    } catch (e: any) {
      setError(e?.message || "failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function create() {
    if (!url) return;
    setCreating(true);
    setError(null);
    try {
      const r = await fetch("/api/brain/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          events: Array.from(events),
          description: description || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `${r.status}`);
      setRevealedSecret({ id: j.id, secret: j.secret });
      setUrl("");
      setDescription("");
      setEvents(new Set(["*"]));
      await refresh();
    } catch (e: any) {
      setError(e?.message || "failed");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this webhook? Existing deliveries will not be retried.")) return;
    try {
      const r = await fetch(`/api/brain/webhooks?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error(`${r.status}`);
      await refresh();
    } catch (e: any) {
      setError(e?.message || "failed");
    }
  }

  function toggleEvent(name: string) {
    setEvents((prev) => {
      const next = new Set(prev);
      if (name === "*") {
        return next.has("*") ? new Set() : new Set(["*"]);
      }
      next.delete("*");
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <section className="bg-bb-surface border border-bb-border rounded-xl p-6 space-y-4">
      <header>
        <h2 className="text-sm uppercase tracking-wider text-bb-text-muted">Webhooks</h2>
        <p className="text-xs text-bb-text-muted/80 mt-1">
          POST brain events to your URL. Each delivery is signed with HMAC-SHA256
          (verify via <code className="text-bb-text-primary">X-Brainbase-Signature</code>).
        </p>
      </header>

      {error ? (
        <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-2 py-1.5">
          {error}
        </div>
      ) : null}

      {revealedSecret ? (
        <div className="text-xs bg-bb-bg-primary border border-bb-accent rounded-md p-3 space-y-1.5">
          <div className="text-bb-accent font-medium">New webhook created — copy the secret now.</div>
          <div className="font-mono break-all text-bb-text-primary">{revealedSecret.secret}</div>
          <button
            onClick={() => setRevealedSecret(null)}
            className="text-xs text-bb-text-muted hover:text-bb-text-primary"
          >
            Got it
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-xs text-bb-text-muted">Loading…</p>
      ) : webhooks.length === 0 ? (
        <p className="text-xs text-bb-text-muted">No webhooks yet.</p>
      ) : (
        <ul className="space-y-2">
          {webhooks.map((w) => (
            <li
              key={w.id}
              className="flex items-start justify-between gap-3 bg-bb-bg-primary border border-bb-border rounded-md p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm text-bb-text-primary font-mono break-all">{w.url}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {w.events.map((e) => (
                    <span
                      key={e}
                      className="text-[10px] font-mono bg-bb-surface border border-bb-border rounded px-1.5 py-0.5 text-bb-text-secondary"
                    >
                      {e}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 text-[11px] text-bb-text-muted">
                  {w.delivery_count} deliveries · {w.failure_count} failures
                  {w.last_delivery_status !== null ? ` · last ${w.last_delivery_status}` : ""}
                  {w.last_delivery_error ? (
                    <span className="ml-2 text-red-400 break-all">{w.last_delivery_error}</span>
                  ) : null}
                </div>
              </div>
              <button
                onClick={() => remove(w.id)}
                className="text-xs text-bb-text-muted hover:text-red-400"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="border border-bb-border rounded-md">
        <summary className="cursor-pointer px-3 py-2 text-xs text-bb-text-secondary hover:text-bb-text-primary">
          + Add webhook
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-app.com/hooks/brainbase"
            className="w-full h-9 px-3 text-xs bg-bb-bg-primary border border-bb-border rounded-md focus:outline-none focus:ring-1 focus:ring-bb-accent"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="w-full h-9 px-3 text-xs bg-bb-bg-primary border border-bb-border rounded-md focus:outline-none focus:ring-1 focus:ring-bb-accent"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => toggleEvent("*")}
              className={`text-[11px] px-2 py-1 rounded border ${
                events.has("*")
                  ? "bg-bb-accent text-bb-bg-primary border-bb-accent"
                  : "bg-bb-surface text-bb-text-secondary border-bb-border"
              }`}
            >
              all events
            </button>
            {ALL_EVENTS.map((e) => (
              <button
                key={e}
                onClick={() => toggleEvent(e)}
                disabled={events.has("*")}
                className={`text-[11px] font-mono px-2 py-1 rounded border ${
                  events.has(e) && !events.has("*")
                    ? "bg-bb-accent text-bb-bg-primary border-bb-accent"
                    : "bg-bb-surface text-bb-text-secondary border-bb-border"
                } disabled:opacity-40`}
              >
                {e}
              </button>
            ))}
          </div>
          <button
            onClick={create}
            disabled={creating || !url || events.size === 0}
            className="h-8 px-3 text-xs rounded-md bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create webhook"}
          </button>
        </div>
      </details>
    </section>
  );
}
