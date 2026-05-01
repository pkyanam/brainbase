interface SearchResult {
  slug: string;
  title: string;
  type: string;
  excerpt: string;
  score: number;
}

export default function PageList({
  results,
  onSelect,
  query,
}: {
  results: SearchResult[];
  onSelect: (slug: string) => void;
  query?: string;
}) {
  if (results.length === 0 && !query?.trim()) return null;
  return (
    <div className="absolute top-full left-0 right-0 mt-2 z-50 max-h-80 overflow-y-auto bg-bb-surface border border-bb-border-strong rounded-lg animate-fade-in">
      {results.length === 0 && query?.trim() ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-bb-text-muted">No results for "{query}"</p>
        </div>
      ) : (
        results.map((r) => (
        <button
          key={r.slug}
          onClick={() => onSelect(r.slug)}
          className="w-full text-left px-4 py-3 hover:bg-bb-surface-hover transition-colors border-b border-bb-border last:border-0"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-bb-text-muted">
              {r.type}
            </span>
            <span className="text-[10px] text-bb-text-muted tabular-nums">
              {Math.round(r.score * 100)}%
            </span>
          </div>
          <div className="text-sm font-medium text-bb-text-primary truncate">{r.title}</div>
          {r.excerpt && (
            <p className="text-xs text-bb-text-muted mt-0.5 line-clamp-1">{r.excerpt}</p>
          )}
        </button>
      )))}
    </div>
  );
}
