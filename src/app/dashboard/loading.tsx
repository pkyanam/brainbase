export default function DashboardLoading() {
  return (
    <div className="h-screen flex flex-col bg-black overflow-hidden">
      <header className="shrink-0 h-12 flex items-center justify-between px-6 border-b border-neutral-900">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-neutral-800 animate-pulse" />
          <div className="w-20 h-4 bg-neutral-800 rounded animate-pulse" />
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neutral-800 border-t-neutral-400 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-neutral-600">Loading your brain...</p>
        </div>
      </div>
    </div>
  );
}
