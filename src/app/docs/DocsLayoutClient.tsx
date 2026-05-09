"use client";

import { useState, useEffect } from "react";
import { List, X } from "@phosphor-icons/react";

const sections = [
  { id: "agent-onboarding", label: "Agent onboarding" },
  { id: "quickstart", label: "Quickstart" },
  { id: "mcp-setup", label: "MCP setup" },
  { id: "sdk", label: "SDK usage" },
  { id: "cli", label: "CLI" },
  { id: "api", label: "API reference" },
  { id: "architecture", label: "Architecture" },
];

function DocsSidebar({ activeId, onNav }: { activeId: string | null; onNav?: () => void }) {
  return (
    <nav className="sticky top-24">
      <p className="text-[11px] font-medium text-bb-text-muted uppercase tracking-widest mb-3 px-3">
        On this page
      </p>
      <ul className="space-y-0.5">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={onNav}
              className={`block px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeId === s.id
                  ? "bg-bb-accent/10 text-bb-accent border-l-2 border-bb-accent"
                  : "text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-surface"
              }`}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function useActiveSection(sectionIds: string[]) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sectionIds]);

  return activeId;
}

export function DocsLayoutClient({ children }: { children: React.ReactNode }) {
  const activeId = useActiveSection(sections.map((s) => s.id));
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden sticky top-14 z-30 bg-bb-bg-primary/90 backdrop-blur-sm border-b border-bb-border px-4 h-11 flex items-center">
        <button
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 h-8 px-2.5 bg-bb-surface border border-bb-border rounded-md text-xs text-bb-text-secondary hover:text-bb-text-primary transition-colors"
        >
          <List className="w-3.5 h-3.5" />
          Sections
        </button>
        {activeId && (
          <span className="ml-2 text-xs text-bb-text-muted truncate">
            {sections.find((s) => s.id === activeId)?.label}
          </span>
        )}
      </div>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            aria-label="Close sidebar"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="relative w-[85vw] max-w-xs h-full bg-bb-bg-primary border-r border-bb-border flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between h-14 px-4 border-b border-bb-border shrink-0">
              <span className="text-[15px] font-semibold text-bb-text-primary">Sections</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center w-10 h-10 rounded-md text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-surface transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <DocsSidebar activeId={activeId} onNav={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex gap-10 lg:gap-14">
        <aside className="hidden lg:block w-56 shrink-0">
          <DocsSidebar activeId={activeId} />
        </aside>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </>
  );
}
