"use client";

interface Props {
  since: string;
  onSinceChange: (v: string) => void;
  limit: number;
  onLimitChange: (v: number) => void;
  onExport: () => void;
  loading: boolean;
}

export default function EvalExportPanel({
  since,
  onSinceChange,
  limit,
  onLimitChange,
  onExport,
  loading,
}: Props) {
  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-xl border border-bb-border bg-bb-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-bb-text-primary">
          Export Evals
        </h3>
        <p className="text-xs text-bb-text-muted">
          Download evaluation results as NDJSON for offline analysis, CI/CD
          integration, or model comparison.
        </p>

        {/* Date range picker */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-bb-text-muted font-medium mb-1">
            Start date
          </label>
          <input
            type="date"
            value={since}
            onChange={(e) => onSinceChange(e.target.value)}
            className="w-full h-10 px-3 bg-bb-bg-primary border border-bb-border rounded-md text-sm text-bb-text-primary outline-none focus:border-bb-accent transition-colors [color-scheme:dark]"
          />
          <p className="text-[10px] text-bb-text-muted mt-1">
            Leave empty to export all results
          </p>
        </div>

        {/* Limit field */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-bb-text-muted font-medium mb-1">
            Max results
          </label>
          <input
            type="number"
            value={limit}
            onChange={(e) =>
              onLimitChange(
                Math.max(1, Math.min(10000, Number(e.target.value) || 100))
              )
            }
            min={1}
            max={10000}
            className="w-full h-10 px-3 bg-bb-bg-primary border border-bb-border rounded-md text-sm text-bb-text-primary outline-none focus:border-bb-accent transition-colors"
          />
          <p className="text-[10px] text-bb-text-muted mt-1">
            Between 1 and 10,000 results. Default: 100.
          </p>
        </div>

        {/* Export button */}
        <button
          onClick={onExport}
          disabled={loading}
          className="w-full h-11 bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-bb-bg-primary/30 border-t-bb-bg-primary rounded-full animate-spin" />
              Exporting...
            </>
          ) : (
            <>
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
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Download NDJSON
            </>
          )}
        </button>
      </div>

      {/* Format info */}
      <div className="rounded-xl border border-bb-border bg-bb-surface/50 p-4">
        <h4 className="text-xs font-semibold text-bb-text-secondary mb-2 uppercase tracking-wider">
          NDJSON Format
        </h4>
        <pre className="text-xs text-bb-text-muted font-mono bg-bb-bg-primary rounded-md p-3 overflow-x-auto">
{`{"id":"ev_01","query":"acme inc","mrr":0.833,"p@3":1.0,...}
{"id":"ev_02","query":"jane doe","mrr":0.500,"p@3":0.67,...}
{"id":"ev_03","query":"seed round","mrr":1.000,"p@3":1.0,...}`}
        </pre>
        <p className="text-[10px] text-bb-text-muted mt-2">
          Each line is a complete JSON object. Compatible with jq, pandas, and
          most data tools.
        </p>
      </div>
    </div>
  );
}
