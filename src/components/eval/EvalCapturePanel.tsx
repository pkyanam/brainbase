"use client";

import { useState, useEffect } from "react";

interface EvalCandidate {
  id: string;
  query: string;
  captured_at: string;
  source: string;
}

interface Filters {
  source: string;
  min_length: string;
  max_length: string;
}

interface Props {
  candidates: EvalCandidate[];
  loading: boolean;
  contributorMode: boolean;
  onContributorModeChange: (v: boolean) => void;
  piiScrub: boolean;
  onPiiScrubChange: (v: boolean) => void;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  onSave: () => void;
}

export default function EvalCapturePanel({
  candidates,
  loading,
  contributorMode,
  onContributorModeChange,
  piiScrub,
  onPiiScrubChange,
  filters,
  onFiltersChange,
  onSave,
}: Props) {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateFilter = (key: keyof Filters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const fmtDate = (d: string): string => {
    try {
      return new Date(d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Toggle switches */}
      <div className="rounded-xl border border-bb-border bg-bb-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-bb-text-primary">
          Capture Modes
        </h3>

        {/* Contributor mode */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bb-text-secondary font-medium">
              Contributor mode
            </p>
            <p className="text-xs text-bb-text-muted mt-0.5">
              Let team members submit query candidates for evaluation
            </p>
          </div>
          <button
            role="switch"
            aria-checked={contributorMode}
            onClick={() => onContributorModeChange(!contributorMode)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 transition-colors cursor-pointer ${
              contributorMode
                ? "bg-bb-accent border-bb-accent"
                : "bg-bb-border border-bb-border"
            }`}
          >
            <span
              className={`inline-block w-3.5 h-3.5 rounded-full bg-bb-bg-primary transition-transform mt-px ${
                contributorMode ? "translate-x-[1.35rem]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* PII scrub */}
        <div className="flex items-center justify-between pt-2 border-t border-bb-border">
          <div>
            <p className="text-sm text-bb-text-secondary font-medium">
              PII scrubbing
            </p>
            <p className="text-xs text-bb-text-muted mt-0.5">
              Automatically redact names, emails, and sensitive data from
              captured queries
            </p>
          </div>
          <button
            role="switch"
            aria-checked={piiScrub}
            onClick={() => onPiiScrubChange(!piiScrub)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 transition-colors cursor-pointer ${
              piiScrub
                ? "bg-bb-accent border-bb-accent"
                : "bg-bb-border border-bb-border"
            }`}
          >
            <span
              className={`inline-block w-3.5 h-3.5 rounded-full bg-bb-bg-primary transition-transform mt-px ${
                piiScrub ? "translate-x-[1.35rem]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Capture filters */}
      <div className="rounded-xl border border-bb-border bg-bb-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-bb-text-primary">
          Capture Filters
        </h3>
        <p className="text-xs text-bb-text-muted">
          Configure which queries are automatically captured for evaluation.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-bb-text-muted font-medium mb-1">
              Source
            </label>
            <select
              value={filters.source}
              onChange={(e) => updateFilter("source", e.target.value)}
              className="w-full h-10 px-3 bg-bb-bg-primary border border-bb-border rounded-md text-sm text-bb-text-primary outline-none focus:border-bb-accent transition-colors"
            >
              <option value="">All sources</option>
              <option value="api">API</option>
              <option value="dashboard">Dashboard</option>
              <option value="slack">Slack</option>
              <option value="mcp">MCP</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-bb-text-muted font-medium mb-1">
              Min length
            </label>
            <input
              type="number"
              value={filters.min_length}
              onChange={(e) => updateFilter("min_length", e.target.value)}
              placeholder="3"
              className="w-full h-10 px-3 bg-bb-bg-primary border border-bb-border rounded-md text-sm text-bb-text-primary placeholder:text-bb-text-muted outline-none focus:border-bb-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-bb-text-muted font-medium mb-1">
              Max length
            </label>
            <input
              type="number"
              value={filters.max_length}
              onChange={(e) => updateFilter("max_length", e.target.value)}
              placeholder="500"
              className="w-full h-10 px-3 bg-bb-bg-primary border border-bb-border rounded-md text-sm text-bb-text-primary placeholder:text-bb-text-muted outline-none focus:border-bb-accent transition-colors"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            className="h-10 px-5 bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary text-sm font-medium rounded-md transition-colors inline-flex items-center gap-2"
          >
            {saved && (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
            {saved ? "Saved" : "Save settings"}
          </button>
        </div>
      </div>

      {/* Captured candidates list */}
      <div className="rounded-xl border border-bb-border bg-bb-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-bb-text-primary">
            Captured Candidates
          </h3>
          {!loading && (
            <span className="text-xs text-bb-text-muted tabular-nums">
              {candidates.length} query{candidates.length !== 1 ? "es" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-10 bg-bb-bg-primary rounded animate-pulse"
              />
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-bb-text-muted">
              No queries captured yet
            </p>
            <p className="text-xs text-bb-text-muted mt-1">
              Enable contributor mode or configure capture filters above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-bb-border -mx-5">
            {candidates.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-bb-bg-primary transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-bb-text-primary truncate font-mono">
                    {c.query}
                  </p>
                  <p className="text-xs text-bb-text-muted mt-0.5">
                    {c.source} · {fmtDate(c.captured_at)}
                  </p>
                </div>
                <button
                  className="shrink-0 ml-3 text-xs text-bb-accent hover:text-bb-accent-strong transition-colors"
                  title="Remove from capture queue"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
