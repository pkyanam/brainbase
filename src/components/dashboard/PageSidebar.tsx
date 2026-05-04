"use client";

import { useState } from "react";

interface PageDetail {
  slug: string;
  title: string;
  type: string;
  content: string;
  public?: boolean;
  links?: {
    outgoing: { slug: string; title: string; link_type: string }[];
    incoming: { slug: string; title: string; link_type: string }[];
  };
  timeline?: { date: string; summary: string }[];
}

export default function PageSidebar({
  page,
  open,
  onClose,
  onSelect,
}: {
  page: PageDetail | null;
  open: boolean;
  onClose: () => void;
  onSelect: (slug: string) => void;
}) {
  const [publicFlag, setPublicFlag] = useState(page?.public ?? false);
  const [savingPublic, setSavingPublic] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);

  // Sync local state when page changes
  if (page && publicFlag !== (page.public ?? false) && !savingPublic) {
    setPublicFlag(page.public ?? false);
  }

  async function togglePublic(newValue: boolean) {
    if (!page) return;
    setSavingPublic(true);
    setPublicError(null);
    try {
      const res = await fetch("/api/brain/wiki/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: page.slug, public: newValue }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Error ${res.status}`);
      }
      setPublicFlag(newValue);
      // Update the page object too
      if (page) page.public = newValue;
    } catch (err: unknown) {
      setPublicError(err instanceof Error ? err.message : "Failed to update");
      // Revert on error
      setPublicFlag(!newValue);
    } finally {
      setSavingPublic(false);
    }
  }

  if (!open || !page) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <button
        onClick={onClose}
        aria-label="Close sidebar"
        className="md:hidden fixed inset-0 z-40 bg-black/60"
      />
      <aside
        className="fixed md:static inset-y-0 right-0 z-50 w-full md:w-96 shrink-0 border-l border-bb-border bg-bb-bg-secondary flex flex-col animate-slide-in-right"
      >
        <header className="shrink-0 px-5 py-4 flex items-start justify-between border-b border-bb-border">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-bb-accent">
                {page.type}
              </span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer group/toggle" title={publicFlag ? "Visible in public wiki" : "Hidden from public wiki"}>
                <input
                  type="checkbox"
                  checked={publicFlag}
                  disabled={savingPublic}
                  onChange={(e) => togglePublic(e.target.checked)}
                  className="w-3 h-3 accent-bb-accent"
                />
                <span className="text-[10px] text-bb-text-muted group-hover/toggle:text-bb-text-secondary transition-colors">
                  {savingPublic ? "..." : publicFlag ? "Public" : "Private"}
                </span>
              </label>
            </div>
            <h2 className="text-base font-semibold text-bb-text-primary break-words">
              {page.title}
            </h2>
            {publicError && (
              <p className="text-[10px] text-bb-danger mt-1">{publicError}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 ml-3 w-8 h-8 inline-flex items-center justify-center rounded-md text-bb-text-muted hover:text-bb-text-primary hover:bg-bb-surface transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {page.links && (page.links.outgoing.length > 0 || page.links.incoming.length > 0) && (
            <div className="mb-5">
              <h3 className="text-[10px] font-medium text-bb-text-muted uppercase tracking-wider mb-2">
                Links
              </h3>
              <div className="space-y-px">
                {page.links.outgoing.slice(0, 8).map((l) => (
                  <button
                    key={l.slug + l.link_type}
                    onClick={() => onSelect(l.slug)}
                    className="w-full text-left text-xs py-2 px-2.5 rounded-md hover:bg-bb-surface transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="text-bb-text-secondary truncate">{l.title}</span>
                    <span className="text-bb-text-muted text-[10px] font-mono shrink-0">
                      {l.link_type}
                    </span>
                  </button>
                ))}
                {page.links.incoming.slice(0, 4).map((l) => (
                  <button
                    key={l.slug + l.link_type}
                    onClick={() => onSelect(l.slug)}
                    className="w-full text-left text-xs py-2 px-2.5 rounded-md hover:bg-bb-surface transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="text-bb-text-muted truncate">← {l.title}</span>
                    <span className="text-bb-text-muted text-[10px] font-mono shrink-0">
                      {l.link_type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="text-sm text-bb-text-secondary leading-relaxed whitespace-pre-wrap">
            {page.content || <span className="text-bb-text-muted italic">No content</span>}
          </div>
          {page.timeline && page.timeline.length > 0 && (
            <div className="mt-5 pt-4 border-t border-bb-border">
              <h3 className="text-[10px] font-medium text-bb-text-muted uppercase tracking-wider mb-3">
                Timeline
              </h3>
              <ol className="space-y-3">
                {page.timeline.map((t, i) => (
                  <li key={i} className="text-xs pl-3 border-l-2 border-bb-border">
                    <div className="text-bb-text-muted font-mono tabular-nums">{t.date}</div>
                    <p className="text-bb-text-secondary mt-1 leading-relaxed">{t.summary}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <footer className="shrink-0 px-5 py-3 border-t border-bb-border">
          <code className="text-[10px] text-bb-text-muted font-mono break-all">{page.slug}</code>
        </footer>
      </aside>
    </>
  );
}
