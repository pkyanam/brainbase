"use client";

import { useEffect, useState } from "react";

interface UsageData {
  plan: string;
  usage: {
    pages: { used: number; limit: number };
    searches: { used: number; limit: number };
    apiCalls: { used: number; limit: number };
  };
}

export function UsageBanner() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/usage")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.plan) setUsage(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!usage || usage.plan !== "free" || dismissed) return null;

  const pagesPct = Math.round((usage.usage.pages.used / usage.usage.pages.limit) * 100);
  const showWarning = pagesPct > 70;

  return (
    <div
      className={`shrink-0 px-4 py-2 flex items-center justify-between gap-3 text-xs border-b ${
        showWarning
          ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
          : "bg-bb-bg-secondary border-bb-border text-bb-text-secondary"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium shrink-0">Free plan</span>
        <span className="text-bb-text-muted hidden sm:inline">·</span>
        <span className="truncate">
          {usage.usage.pages.used}/{usage.usage.pages.limit} pages
          {showWarning && " — running low"}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href="/pricing"
          className="inline-flex h-7 px-3 items-center rounded text-xs font-medium bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary transition-colors"
        >
          Upgrade
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="text-bb-text-muted hover:text-bb-text-primary transition-colors"
          title="Dismiss"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
