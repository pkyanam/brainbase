interface Activity {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_slug: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  page_created: "created page",
  page_updated: "updated page",
  page_deleted: "deleted page",
  link_created: "added link",
  link_deleted: "removed link",
  timeline_added: "added timeline entry",
  member_joined: "joined brain",
  invite_sent: "sent invite",
};

export default function ActivityFeed({
  activities,
  open,
  onToggle,
  onSelect,
}: {
  activities: Activity[];
  open: boolean;
  onToggle: () => void;
  onSelect: (slug: string) => void;
}) {
  return (
    <section className="flex-1 min-h-0 flex flex-col border-b border-bb-border">
      <button
        onClick={onToggle}
        className="shrink-0 h-11 px-4 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-bb-text-secondary hover:text-bb-text-primary transition-colors"
      >
        <span className="flex items-center gap-2">
          Activity
          {activities.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-bb-surface border border-bb-border text-[10px] text-bb-text-muted tabular-nums normal-case tracking-normal">
              {activities.length}
            </span>
          )}
        </span>
        <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-px">
          {activities.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-bb-surface border border-bb-border flex items-center justify-center">
                <svg className="w-5 h-5 text-bb-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-xs text-bb-text-secondary mb-1">No activity yet</p>
              <p className="text-[11px] text-bb-text-muted leading-relaxed max-w-[200px] mx-auto">
                Pages, links, and timeline entries will appear here as your brain evolves.
              </p>
            </div>
          ) : (
            activities.map((a) => (
              <div key={a.id} className="text-xs py-2 border-b border-bb-border last:border-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-bb-accent">{actionLabels[a.action] || a.action}</span>
                  {a.entity_slug && (
                    <button
                      onClick={() => a.entity_slug && onSelect(a.entity_slug)}
                      className="text-bb-text-secondary hover:text-bb-text-primary truncate max-w-[160px]"
                    >
                      {a.entity_slug}
                    </button>
                  )}
                </div>
                <div className="text-bb-text-muted mt-1 tabular-nums">
                  {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
