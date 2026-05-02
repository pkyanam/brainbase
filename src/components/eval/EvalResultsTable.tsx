"use client";

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
          <svg
            className="w-6 h-6 text-bb-danger"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
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
          <svg
            className="w-8 h-8 text-bb-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"
            />
          </svg>
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
