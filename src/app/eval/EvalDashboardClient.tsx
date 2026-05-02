"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { useTheme } from "@/components/ThemeProvider";
import EvalResultsTable from "@/components/eval/EvalResultsTable";
import EvalCapturePanel from "@/components/eval/EvalCapturePanel";
import EvalExportPanel from "@/components/eval/EvalExportPanel";

interface EvalRun {
  id: string;
  query: string;
  mrr: number;
  p_at_3: number;
  p_at_5: number;
  latency_ms: number;
  date: string;
  status: "pass" | "fail";
}

interface EvalCandidate {
  id: string;
  query: string;
  captured_at: string;
  source: string;
}

type TabId = "results" | "capture" | "export";

const TABS: { id: TabId; label: string }[] = [
  { id: "results", label: "Results" },
  { id: "capture", label: "Capture" },
  { id: "export", label: "Export" },
];

export default function EvalDashboard() {
  const { user, isLoaded } = useUser();
  const { resolved: themeResolved, toggle: toggleTheme } = useTheme();

  const [evals, setEvals] = useState<EvalRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("results");
  const [runLoading, setRunLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // Capture tab state
  const [candidates, setCandidates] = useState<EvalCandidate[]>([]);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [contributorMode, setContributorMode] = useState(false);
  const [piiScrub, setPiiScrub] = useState(true);
  const [captureFilters, setCaptureFilters] = useState({
    source: "",
    min_length: "",
    max_length: "",
  });

  // Export tab state
  const [exportSince, setExportSince] = useState("");
  const [exportLimit, setExportLimit] = useState(100);
  const [exportLoading, setExportLoading] = useState(false);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Fetch evals list
  useEffect(() => {
    if (!isLoaded || !user) return;
    setLoading(true);
    setError(null);
    fetch("/api/eval/list")
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(body.detail || body.error || `HTTP ${r.status}`);
        }
        // Map API response { runs } to frontend { evals } format
        const mapped = (body.runs || []).map((run: any) => ({
          id: run.id,
          query: `Eval #${run.total_queries || 0} queries`,
          mrr: run.avg_mrr ?? 0,
          p_at_3: run.avg_p3 ?? 0,
          p_at_5: run.avg_p5 ?? 0,
          latency_ms: run.avg_latency_ms ?? 0,
          date: run.created_at ?? "",
          status: run.status === "completed" ? "pass" : run.status === "failed" ? "fail" : "pass",
        }));
        setEvals(mapped);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load evals");
        setLoading(false);
      });
  }, [isLoaded, user]);

  // Fetch capture candidates when capture tab is active
  useEffect(() => {
    if (activeTab !== "capture" || !isLoaded || !user) return;
    setCaptureLoading(true);
    fetch("/api/eval/candidates")
      .then((r) => r.json())
      .then((d) => {
        setCandidates(d.candidates || []);
        setCaptureLoading(false);
      })
      .catch(() => setCaptureLoading(false));
  }, [activeTab, isLoaded, user]);

  const handleRunEval = useCallback(async () => {
    setRunLoading(true);
    try {
      const r = await fetch("/api/eval/run", { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || data.error || `HTTP ${r.status}`);
      setToast({ message: "Eval run started!", type: "success" });
      // Refresh list after a short delay
      setTimeout(() => {
        fetch("/api/eval/list")
          .then((r) => r.json())
          .then((d) => setEvals(d.evals || []))
          .catch(() => {});
      }, 2000);
    } catch (err: unknown) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to start eval run",
        type: "error",
      });
    } finally {
      setRunLoading(false);
    }
  }, []);

  const handleSaveCaptureSettings = useCallback(async () => {
    setToast({ message: "Capture settings saved", type: "success" });
  }, []);

  const handleExport = useCallback(async () => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams();
      if (exportSince) params.set("since", exportSince);
      if (exportLimit) params.set("limit", String(exportLimit));
      const r = await fetch(`/api/eval/export?${params.toString()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eval-export-${new Date().toISOString().slice(0, 10)}.ndjson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToast({ message: "Export downloaded", type: "success" });
    } catch (err: unknown) {
      setToast({
        message:
          err instanceof Error ? err.message : "Export failed",
        type: "error",
      });
    } finally {
      setExportLoading(false);
    }
  }, [exportSince, exportLimit]);

  return (
    <div className="h-[100dvh] flex flex-col bg-bb-bg-primary overflow-hidden">
      {/* Top bar — matches DashboardClient header exactly */}
      <header className="shrink-0 h-12 md:h-14 flex items-center justify-between px-3 md:px-5 border-b border-bb-border bg-bb-bg-primary">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <a href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="/brainbaseLogo.png"
              alt="Brainbase"
              width={22}
              height={22}
              className="rounded"
              priority
            />
            <span className="text-sm font-semibold tracking-tight text-bb-text-primary">
              brainbase
            </span>
          </a>
          <span className="hidden md:inline text-bb-border-strong">/</span>
          <span className="hidden md:inline text-xs text-bb-text-muted font-mono">
            eval
          </span>
        </div>

        <div className="flex items-center gap-1 md:gap-2 text-xs min-w-0">
          {/* More menu dropdown — same as DashboardClient */}
          <div className="hidden md:block relative">
            <button
              onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
              onBlur={() => setTimeout(() => setHeaderMenuOpen(false), 200)}
              className="inline-flex h-8 w-8 items-center justify-center text-bb-text-muted hover:text-bb-text-primary hover:bg-bb-surface rounded transition-colors"
              title="More"
            >
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
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>
            {headerMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-bb-surface border border-bb-border rounded-lg shadow-lg py-1 z-50 animate-fade-in">
                <a
                  href="/docs"
                  className="block px-3 py-2 text-xs text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-bg-primary transition-colors"
                >
                  Docs
                </a>
                <a
                  href="/admin"
                  className="block px-3 py-2 text-xs text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-bg-primary transition-colors"
                >
                  Admin
                </a>
                <a
                  href="/settings"
                  className="block px-3 py-2 text-xs text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-bg-primary transition-colors"
                >
                  Settings
                </a>
                <div className="border-t border-bb-border mt-1 pt-1">
                  <a
                    href="/dashboard"
                    className="block px-3 py-2 text-xs text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-bg-primary transition-colors"
                  >
                    Dashboard
                  </a>
                  <a
                    href="/graph"
                    className="block px-3 py-2 text-xs text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-bg-primary transition-colors"
                  >
                    Graph
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Theme toggle — same as DashboardClient */}
          <button
            onClick={toggleTheme}
            className="hidden md:inline-flex h-8 w-8 items-center justify-center text-bb-text-muted hover:text-bb-text-primary hover:bg-bb-surface rounded transition-colors"
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {themeResolved === "dark" ? (
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
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
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
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>

          {isLoaded && user ? (
            <>
              <span
                className="hidden lg:inline-block text-bb-text-secondary truncate max-w-[140px] font-mono"
                title={user.primaryEmailAddress?.emailAddress || ""}
              >
                {user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
                  user.id.slice(0, 6)}
              </span>

              <SignOutButton>
                <button className="hidden md:inline-flex h-8 px-3 items-center text-bb-text-muted hover:text-bb-text-primary hover:bg-bb-surface rounded transition-colors">
                  Sign out
                </button>
              </SignOutButton>
            </>
          ) : (
            <a
              href="/sign-in"
              className="h-8 px-3 inline-flex items-center text-bb-accent hover:text-bb-accent-strong transition-colors"
            >
              Sign in
            </a>
          )}
        </div>
      </header>

      {/* Page body */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header section with title and action */}
        <div className="shrink-0 px-4 md:px-6 pt-6 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-bb-text-primary">
              Eval Dashboard
            </h1>
            <p className="text-sm text-bb-text-muted mt-0.5">
              Measure search quality with automated eval runs
            </p>
          </div>
          <button
            onClick={handleRunEval}
            disabled={runLoading}
            className="inline-flex items-center gap-2 h-11 px-5 bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {runLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-bb-bg-primary/30 border-t-bb-bg-primary rounded-full animate-spin" />
                Running...
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
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Run Eval
              </>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 px-4 md:px-6 border-b border-bb-border">
          <nav className="flex gap-0 -mb-px" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-bb-accent text-bb-accent"
                    : "border-transparent text-bb-text-muted hover:text-bb-text-secondary hover:border-bb-border-strong"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
          {activeTab === "results" && (
            <EvalResultsTable
              evals={evals}
              loading={loading}
              error={error}
            />
          )}

          {activeTab === "capture" && (
            <EvalCapturePanel
              candidates={candidates}
              loading={captureLoading}
              contributorMode={contributorMode}
              onContributorModeChange={setContributorMode}
              piiScrub={piiScrub}
              onPiiScrubChange={setPiiScrub}
              filters={captureFilters}
              onFiltersChange={setCaptureFilters}
              onSave={handleSaveCaptureSettings}
            />
          )}

          {activeTab === "export" && (
            <EvalExportPanel
              since={exportSince}
              onSinceChange={setExportSince}
              limit={exportLimit}
              onLimitChange={setExportLimit}
              onExport={handleExport}
              loading={exportLoading}
            />
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-lg text-xs font-medium shadow-lg border transition-all animate-fade-in ${
            toast.type === "error"
              ? "bg-bb-danger text-white border-bb-danger"
              : "bg-bb-accent text-bb-bg-primary border-bb-accent"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
