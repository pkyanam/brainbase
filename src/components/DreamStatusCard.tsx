"use client";

import { useEffect, useState, useCallback } from "react";

interface DreamStatus {
  brain_id: string;
  status: string;
  pages: number;
  links: number;
  orphans: number;
  stale_chunks: number;
  tiered_entities: number;
  last_extracted_at: string | null;
}

export default function DreamStatusCard({ brainId }: { brainId: string | null }) {
  const [status, setStatus] = useState<DreamStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [dreaming, setDreaming] = useState(false);
  const [error, setError] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!brainId) return;
    try {
      setLoading(true);
      const r = await fetch(`/api/brain/dream?brain_id=${brainId}`);
      if (!r.ok) throw new Error();
      const data = await r.json();
      setStatus(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [brainId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleDream = async () => {
    if (!brainId) return;
    setDreaming(true);
    try {
      const r = await fetch(`/api/brain/dream?brain_id=${brainId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ process_all: true }),
      });
      const data = await r.json();
      if (!data.error) {
        // Refresh stats after a short delay
        setTimeout(fetchStatus, 1000);
      }
    } catch {
      // ignore
    } finally {
      setDreaming(false);
    }
  };

  if (error) {
    return (
      <div className="p-3 rounded-lg bg-bb-bg-secondary border border-bb-border text-xs text-bb-text-muted">
        Dream status unavailable
      </div>
    );
  }

  const lastExtracted = status?.last_extracted_at
    ? new Date(status.last_extracted_at).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never";

  return (
    <div className="p-3 rounded-lg bg-bb-bg-secondary border border-bb-border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-bb-text-muted">Dream Cycle</span>
          {dreaming && (
            <span className="inline-flex items-center gap-1 text-[10px] text-bb-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-bb-accent animate-pulse" />
              Dreaming...
            </span>
          )}
        </div>
        <button
          onClick={handleDream}
          disabled={dreaming}
          className="px-3 py-1 bg-bb-accent/10 border border-bb-accent/30 rounded-md text-xs text-bb-accent hover:bg-bb-accent/20 transition-colors disabled:opacity-50"
        >
          {dreaming ? "Running..." : "Run Now"}
        </button>
      </div>

      {loading && !status ? (
        <div className="text-xs text-bb-text-muted">Loading...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="text-center">
            <div className="text-lg font-bold text-bb-text-primary">{status?.orphans ?? "—"}</div>
            <div className="text-[10px] text-bb-text-muted uppercase">Orphans</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-bb-text-primary">{status?.stale_chunks ?? "—"}</div>
            <div className="text-[10px] text-bb-text-muted uppercase">Stale Embeds</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-bb-text-primary">{status?.tiered_entities ?? "—"}</div>
            <div className="text-[10px] text-bb-text-muted uppercase">Tiered</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-bb-text-primary">{lastExtracted}</div>
            <div className="text-[10px] text-bb-text-muted uppercase">Last Dream</div>
          </div>
        </div>
      )}

      <div className="mt-2 text-[10px] text-bb-text-muted/60">
        Runs automatically every 6 hours. Click "Run Now" to process all pages at once.
      </div>
    </div>
  );
}
