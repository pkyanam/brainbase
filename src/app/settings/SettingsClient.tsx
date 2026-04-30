"use client";

import { useState, useEffect, FormEvent } from "react";
import { useUser } from "@clerk/nextjs";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

function useBaseUrl() {
  const [baseUrl, setBaseUrl] = useState("https://brainbase.belweave.ai");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);
  return baseUrl;
}

interface ApiKey {
  id: string;
  brain_id: string;
  name: string | null;
  created_at: string;
  last_used_at: string | null;
  key_prefix: string;
}

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
  expires_at: string;
}

export default function SettingsClient() {
  const { user, isLoaded } = useUser();
  const baseUrl = useBaseUrl();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    loadData();
  }, [isLoaded, user]);

  const loadData = async () => {
    try {
      const [keysRes, shareRes] = await Promise.all([
        fetch("/api/keys"),
        fetch("/api/brain/share"),
      ]);
      const keysData = await keysRes.json();
      const shareData = await shareRes.json();
      setKeys(keysData.keys || []);
      setMembers(shareData.members || []);
      setInvites(shareData.invites || []);
    } catch {
      setError("Failed to load settings");
    }
  };

  async function createKey(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setNewKey(null);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName || "Production" }),
      });
      const data = await res.json();
      if (data.key) {
        setNewKey(data.key);
        setNewKeyName("");
        setKeys((prev) => [
          {
            id: data.record.id,
            brain_id: data.record.brain_id,
            name: data.record.name,
            created_at: data.record.created_at,
            last_used_at: null,
            key_prefix: data.key.slice(0, 16),
          },
          ...prev,
        ]);
      } else {
        throw new Error(data.error || "Failed to create key");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setLoading(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this key? Any integrations using it will break.")) return;
    try {
      await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      console.error("Failed to revoke key:", err);
    }
  }

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brain/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteEmail("");
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Remove this member?")) return;
    await fetch(`/api/brain/share?user_id=${userId}`, { method: "DELETE" });
    loadData();
  };

  const handleCancelInvite = async (id: string) => {
    if (!confirm("Cancel this invite?")) return;
    await fetch(`/api/brain/share?invite_id=${id}`, { method: "DELETE" });
    loadData();
  };

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-bb-bg-primary flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-bb-border border-t-bb-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bb-bg-primary flex items-center justify-center text-bb-text-secondary text-sm">
        <a href="/sign-in" className="text-bb-accent hover:text-bb-accent-strong underline">Sign in</a>
        <span className="ml-1">to manage your API keys.</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary flex flex-col">
      <Nav />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-5 md:px-6 py-10 md:py-14">
          <div className="mb-10">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">Settings</h1>
            <p className="text-bb-text-secondary text-sm">Manage your brain, API keys, and team.</p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 bg-bb-surface border border-bb-danger/40 rounded-lg text-xs text-bb-danger">
              {error}
            </div>
          )}

          {/* API Keys */}
          <Section title="API keys" description="Programmatic access to your brain. Keys are shown once.">
            <form onSubmit={createKey} className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Production)"
                className="flex-1 h-10 px-3 bg-bb-bg-secondary border border-bb-border rounded-md text-sm text-bb-text-primary placeholder:text-bb-text-muted outline-none focus:border-bb-accent transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="h-10 px-4 bg-bb-accent hover:bg-bb-accent-strong disabled:opacity-50 text-bb-bg-primary text-sm font-medium rounded-md transition-colors shrink-0"
              >
                {loading ? "Creating…" : "Create key"}
              </button>
            </form>

            {newKey && (
              <div className="mb-4 p-4 bg-bb-accent-glow border border-bb-accent/40 rounded-lg">
                <p className="text-sm text-bb-accent font-medium mb-2">
                  Key created. Copy it now, you won&apos;t see it again.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <code className="flex-1 bg-bb-bg-primary border border-bb-border rounded-md px-3 py-2 text-xs font-mono text-bb-text-primary break-all">
                    {newKey}
                  </code>
                  <button
                    onClick={() => copy(newKey)}
                    className="h-9 px-3 bg-bb-surface hover:bg-bb-surface-hover border border-bb-border text-bb-text-primary text-xs rounded-md transition-colors shrink-0"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}

            {keys.length === 0 ? (
              <EmptyState title="No API keys yet" body="Create one to start using the Brainbase API." />
            ) : (
              <div className="border border-bb-border rounded-lg overflow-hidden bg-bb-bg-secondary divide-y divide-bb-border">
                {keys.map((k) => (
                  <div key={k.id} className="flex items-center justify-between p-4 gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-bb-text-primary">{k.name || "Unnamed key"}</div>
                      <div className="text-xs text-bb-text-muted font-mono mt-0.5 truncate">
                        {k.key_prefix}···  ·  Created {formatDateTime(k.created_at)}
                        {k.last_used_at && ` · Last used ${formatDateTime(k.last_used_at)}`}
                      </div>
                    </div>
                    <button
                      onClick={() => revokeKey(k.id)}
                      className="text-xs text-bb-danger hover:text-bb-text-primary hover:bg-bb-danger/15 px-3 h-9 rounded-md transition-colors shrink-0"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Brain Sharing */}
          <Section title="Brain sharing" description="Invite teammates to collaborate on this brain.">
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                required
                className="flex-1 h-10 px-3 bg-bb-bg-secondary border border-bb-border rounded-md text-sm text-bb-text-primary placeholder:text-bb-text-muted outline-none focus:border-bb-accent transition-colors"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="h-10 px-3 bg-bb-bg-secondary border border-bb-border rounded-md text-sm text-bb-text-primary outline-none focus:border-bb-accent transition-colors shrink-0"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                disabled={loading}
                className="h-10 px-4 bg-bb-accent hover:bg-bb-accent-strong disabled:opacity-50 text-bb-bg-primary text-sm font-medium rounded-md transition-colors shrink-0"
              >
                Invite
              </button>
            </form>

            <div className="mb-4">
              <h3 className="text-[11px] font-medium text-bb-text-muted uppercase tracking-wider mb-2">Members</h3>
              {members.length === 0 ? (
                <p className="text-xs text-bb-text-muted">No members yet.</p>
              ) : (
                <div className="border border-bb-border rounded-lg bg-bb-bg-secondary divide-y divide-bb-border overflow-hidden">
                  {members.map((m) => (
                    <div key={m.user_id} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="text-xs text-bb-text-secondary font-mono truncate">{m.user_id.slice(0, 20)}…</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-bb-text-muted uppercase tracking-wider font-medium px-1.5 py-0.5 border border-bb-border rounded">{m.role}</span>
                        <button
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="text-[11px] text-bb-danger hover:text-bb-text-primary hover:bg-bb-danger/15 px-2 h-8 rounded-md transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {invites.length > 0 && (
              <div>
                <h3 className="text-[11px] font-medium text-bb-text-muted uppercase tracking-wider mb-2">Pending invites</h3>
                <div className="border border-bb-border rounded-lg bg-bb-bg-secondary divide-y divide-bb-border overflow-hidden">
                  {invites.map((i) => (
                    <div key={i.id} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="text-xs text-bb-text-secondary truncate">{i.email}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-bb-text-muted uppercase tracking-wider font-medium px-1.5 py-0.5 border border-bb-border rounded">{i.role}</span>
                        <button
                          onClick={() => handleCancelInvite(i.id)}
                          className="text-[11px] text-bb-danger hover:text-bb-text-primary hover:bg-bb-danger/15 px-2 h-8 rounded-md transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Brain info */}
          <Section title="Your brain" description="Account details for this workspace.">
            <div className="p-4 border border-bb-border rounded-lg bg-bb-bg-secondary">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <KeyValue label="User ID" mono value={user.id} />
                <KeyValue label="Email" value={user.primaryEmailAddress?.emailAddress || "N/A"} />
              </div>
            </div>
          </Section>

          {/* Quick reference */}
          <Section title="Quick reference" description="API surface area at a glance." last>
            <div className="bg-bb-bg-secondary border border-bb-border rounded-lg p-5 space-y-4">
              <KeyValue label="Base URL" mono value={baseUrl} />
              <KeyValue label="Auth header" mono value="Authorization: Bearer <your_key>" />
              <KeyValue label="MCP endpoint" mono value="POST /api/mcp" />
            </div>
          </Section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Section({
  title,
  description,
  children,
  last = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={last ? "" : "mb-12 pb-10 border-b border-bb-border"}>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-bb-text-primary">{title}</h2>
        {description && <p className="text-sm text-bb-text-muted mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function KeyValue({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="block text-[11px] uppercase tracking-wider text-bb-text-muted font-medium mb-1">
        {label}
      </span>
      <span className={`${mono ? "font-mono" : ""} text-xs text-bb-text-primary break-all block`}>
        {value}
      </span>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center py-10 border border-dashed border-bb-border rounded-lg bg-bb-bg-secondary">
      <p className="text-sm text-bb-text-primary font-medium">{title}</p>
      <p className="text-xs text-bb-text-muted mt-1">{body}</p>
    </div>
  );
}
