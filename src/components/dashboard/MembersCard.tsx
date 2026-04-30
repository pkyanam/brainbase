interface Member {
  user_id: string;
  role: string;
  created_at: string;
}
interface Invite {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function MembersCard({
  members,
  invites,
  open,
  onToggle,
}: {
  members: Member[];
  invites: Invite[];
  open: boolean;
  onToggle: () => void;
}) {
  const total = members.length + 1; // +1 for current user (owner)
  return (
    <section className="shrink-0 flex flex-col">
      <button
        onClick={onToggle}
        className="shrink-0 h-11 px-4 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-bb-text-secondary hover:text-bb-text-primary transition-colors"
      >
        <span className="flex items-center gap-2">
          Members
          <span className="px-1.5 py-0.5 rounded bg-bb-surface border border-bb-border text-[10px] text-bb-text-muted tabular-nums normal-case tracking-normal">
            {total}
          </span>
        </span>
        <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-1.5 max-h-56 overflow-y-auto">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between text-xs py-1">
              <span className="text-bb-text-secondary truncate font-mono">{m.user_id.slice(0, 14)}…</span>
              <span className="text-[10px] uppercase tracking-wider text-bb-text-muted px-1.5 py-0.5 bg-bb-surface border border-bb-border rounded">
                {m.role}
              </span>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-xs text-bb-text-muted py-2">Only you for now.</p>
          )}
          {invites.length > 0 && (
            <div className="pt-2 mt-2 border-t border-bb-border">
              <div className="text-[10px] uppercase tracking-wider text-bb-text-muted mb-1.5">Pending</div>
              {invites.map((i) => (
                <div key={i.id} className="flex items-center justify-between text-xs py-1">
                  <span className="text-bb-text-muted truncate">{i.email}</span>
                  <span className="text-[10px] uppercase tracking-wider text-bb-text-muted">{i.role}</span>
                </div>
              ))}
            </div>
          )}
          <a
            href="/settings"
            className="block mt-2 text-center text-xs text-bb-accent hover:text-bb-accent-strong transition-colors"
          >
            Manage sharing →
          </a>
        </div>
      )}
    </section>
  );
}
