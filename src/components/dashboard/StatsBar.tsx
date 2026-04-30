import type { ReactNode } from "react";

interface Stat {
  label: string;
  value: number | string | undefined;
  suffix?: string;
  tone?: "accent" | "muted" | "danger" | "warning" | "info";
}

const toneClass: Record<NonNullable<Stat["tone"]>, string> = {
  accent: "text-bb-accent",
  muted: "text-bb-text-secondary",
  danger: "text-bb-danger",
  warning: "text-bb-warning",
  info: "text-bb-info",
};

export default function StatsBar({
  stats,
  error,
  children,
}: {
  stats: Stat[];
  error?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-bb-border bg-bb-bg-primary">
      <div className="px-4 md:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline gap-2 min-w-0">
            <span className="text-[10px] md:text-[11px] uppercase tracking-wider font-medium text-bb-text-muted">
              {s.label}
            </span>
            <span className={`text-sm md:text-base font-semibold tabular-nums ${toneClass[s.tone || "muted"]}`}>
              {s.value ?? "—"}
              {s.suffix || ""}
            </span>
          </div>
        ))}
        {children}
      </div>
      {error && (
        <div className="px-4 md:px-6 pb-3 text-xs text-bb-danger">
          Stats unavailable. The API may be offline.
        </div>
      )}
    </div>
  );
}
