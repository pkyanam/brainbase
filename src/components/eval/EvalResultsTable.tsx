"use client";

import { Warning, Database } from "@phosphor-icons/react";

interface EvalRun {
  id: string;
  query: string;
  mrr: number;
  p_at_3: number;
  p_at_5: number;
  latency_ms: number;
  date: string;
  status: "pass" | "fail" | "running";
}

interface Props {
  evals: EvalRun[];
  loading: boolean;
  error: string | null;
}

export default function EvalResultsTable({ evals, loading, error }: Props) {
  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-12 bg-bb-surface rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-xl border border-bb-danger/30 bg-bb-danger/5 p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-bb-danger/10 border border-bb-danger/20 flex items-center justify-center mx-auto mb-3">
          <Warning className="w-6 h-6 text-bb-danger" weight="fill" />
        </div>
        <h3 className="text-sm font-semibold text-bb-text-primary mb-1">
          Failed to load evals
        </h3>
        <p className="text-xs text-bb-text-muted">{error}</p>
      </div>
    );
  }

  // Empty state
  if (evals.length === 0) {
    return (
      <div className="rounded-xl border border-bb-border bg-bb-surface p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-bb-accent/10 border border-bb-accent/20 flex items-center justify-center mx-auto mb-4">
          <Database className="w-8 h-8 text-bb-accent" />
        </div>
        <h3 className="text-lg font-semibold text-bb-text-primary mb-2">
          No evals yet
        </h3>
        <p className="text-sm text-bb-text-secondary mb-2 max-w-md mx-auto leading-relaxed">
          Run your first eval to populate results.
        </p>
        <p className="text-xs text-bb-text-muted">
          Click &ldquo;Run Eval&rdquo; above to measure retrieval quality across
          your knowledge graph.
        </p>
      </div>
    );
  }

  // Format metrics for display
  const fmtMetric = (v: number, decimals = 3): string =>
    v != null ? v.toFixed(decimals) : "—";

  const fmtDate = (d: string): string => {
    try {
      return new Date(d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-bb-border text-left">
            <th className="font-medium text-bb-text-muted uppercase tracking-wider text-[11px] py-3 pr-4">
              Query
            </th>
            <th className="font-medium text-bb-text-muted uppercase tracking-wider text-[11px] py-3 px-3 text-right tabular-nums">
              MRR
            </th>
            <th className="font-medium text-bb-text-muted uppercase tracking-wider text-[11px] py-3 px-3 text-right tabular-nums">
              P@3
            </th>
            <th className="font-medium text-bb-text-muted uppercase tracking-wider text-[11px] py-3 px-3 text-right tabular-nums">
              P@5
            </th>
            <th className="font-medium text-bb-text-muted uppercase tracking-wider text-[11px] py-3 px-3 text-right tabular-nums">
              Latency
            </th>
            <th className="font-medium text-bb-text-muted uppercase tracking-wider text-[11px] py-3 px-3 text-right tabular-nums">
              Date
            </th>
            <th className="font-medium text-bb-text-muted uppercase tracking-wider text-[11px] py-3 pl-3">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-bb-border">
          {evals.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-bb-surface transition-colors group"
            >
              <td className="py-3 pr-4 max-w-[280px]">
                <span className="text-bb-text-primary truncate block font-mono text-xs">
                  {row.query}
                </span>
              </td>
              <td className="py-3 px-3 text-right tabular-nums text-bb-text-secondary">
                {fmtMetric(row.mrr)}
              </td>
              <td className="py-3 px-3 text-right tabular-nums text-bb-text-secondary">
                {fmtMetric(row.p_at_3)}
              </td>
              <td className="py-3 px-3 text-right tabular-nums text-bb-text-secondary">
                {fmtMetric(row.p_at_5)}
              </td>
              <td className="py-3 px-3 text-right tabular-nums text-bb-text-muted font-mono text-xs">
                {row.latency_ms != null ? `${row.latency_ms}ms` : "—"}
              </td>
              <td className="py-3 px-3 text-right tabular-nums text-bb-text-muted text-xs whitespace-nowrap">
                {fmtDate(row.date)}
              </td>
              <td className="py-3 pl-3">
                {row.status === "running" ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-bb-accent/10 text-bb-accent border border-bb-accent/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-bb-accent animate-pulse" />
                    Running...
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      row.status === "pass"
                        ? "bg-bb-success/10 text-bb-success border border-bb-success/20"
                        : "bg-bb-danger/10 text-bb-danger border border-bb-danger/20"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        row.status === "pass" ? "bg-bb-success" : "bg-bb-danger"
                      }`}
                    />
                    {row.status === "pass" ? "Pass" : "Fail"}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
