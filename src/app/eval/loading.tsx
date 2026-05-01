export default function EvalLoading() {
  return (
    <div className="h-screen flex flex-col bg-bb-bg-primary overflow-hidden">
      <header className="shrink-0 h-12 md:h-14 flex items-center justify-between px-3 md:px-5 border-b border-bb-border">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-bb-surface animate-pulse" />
          <div className="w-20 h-4 bg-bb-surface rounded animate-pulse" />
        </div>
        <div className="w-24 h-8 bg-bb-surface rounded animate-pulse" />
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-bb-border border-t-bb-accent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-bb-text-muted">Loading eval dashboard...</p>
        </div>
      </div>
    </div>
  );
}
