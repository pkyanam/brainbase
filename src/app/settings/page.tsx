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

export default function SettingsPage() {
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
        <div className="w-6 h-6 border-2 border-bb-border border-t-bb-text-muted rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bb-bg-primary flex items-center justify-center text-bb-text-secondary">
        <a href="/sign-in" className="text-bb-accent hover:underline">Sign in</a> to manage your API keys.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary">
      <Nav />

      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-bb-text-muted text-sm mb-8">Manage your brain, API keys, and team.</p>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}

        {/* API Keys */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">API Keys</h2>
          </div>

          <form onSubmit={createKey} className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name..."
              className="flex-1 bg-bb-bg-secondary border border-bb-border rounded-lg px-3 py-2 text-sm text-bb-text-secondary placeholder:text-bb-text-muted outline-none focus:border-bb-border-hover"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-bb-accent hover:bg-bb-accent-dim disabled:opacity-50 text-bb-bg-primary text-sm font-medium rounded-lg transition-colors shrink-0"
            >
              {loading ? "Creating..." : "Create key"}
            </button>
          </form>

          {newKey && (
            <div className="mb-6 p-4 bg-bb-accent-glow border border-bb-accent/30 rounded-xl">
              <p className="text-sm text-bb-accent font-medium mb-2">Key created — copy it now, you won&apos;t see it again.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-bb-bg-primary border border-bb-accent/30 rounded-lg px-3 py-2 text-sm font-mono text-bb-accent break-all">{newKey}</code>
                <button onClick={() => copy(newKey)} className="px-3 py-2 bg-bb-accent/20 hover:bg-bb-accent/30 text-bb-accent text-sm rounded-lg transition-colors shrink-0">
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {keys.length === 0 ? (
            <div className="text-center py-12 border border-bb-border rounded-xl bg-bb-bg-secondary">
              <p className="text-bb-text-muted text-sm">No API keys yet.</p>
              <p className="text-bb-text-muted text-xs mt-1">Create one to start using the Brainbase API.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between p-4 border border-bb-border rounded-xl bg-bb-bg-secondary hover:border-bb-border-hover transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-bb-text-secondary">{k.name || "Unnamed key"}</div>
                    <div className="text-xs text-bb-text-muted font-mono mt-0.5">
                      {k.key_prefix}…··· · Created {formatDateTime(k.created_at)}
                      {k.last_used_at && ` · Last used ${formatDateTime(k.last_used_at)}`}
                    </div>
                  </div>
                  <button
                    onClick={() => revokeKey(k.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-950/30 shrink-0 ml-3"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Brain Sharing */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Brain Sharing</h2>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Invite by email..."
              required
              className="flex-1 bg-bb-bg-secondary border border-bb-border rounded-lg px-3 py-2 text-sm text-bb-text-secondary placeholder:text-bb-text-muted outline-none focus:border-bb-border-hover"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="bg-bb-bg-secondary border border-bb-border rounded-lg px-3 py-2 text-sm text-bb-text-secondary outline-none focus:border-bb-border-hover shrink-0"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-bb-accent hover:bg-bb-accent-dim disabled:opacity-50 text-bb-bg-primary text-sm font-medium rounded-lg transition-colors shrink-0"
            >
              Invite
            </button>
          </form>

          {/* Members */}
          <div className="mb-4">
            <h3 className="text-xs font-medium text-bb-text-muted uppercase tracking-wider mb-2">Members</h3>
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between px-4 py-2.5 bg-bb-bg-secondary border border-bb-border rounded-lg mb-1.5">
                <div className="text-xs text-bb-text-secondary font-mono truncate max-w-[200px]">{m.user_id.slice(0, 16)}…</div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-bb-text-muted uppercase">{m.role}</span>
                  <button onClick={() => handleRemoveMember(m.user_id)} className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-950/30 transition-colors">Remove</button>
                </div>
              </div>
            ))}
            {members.length === 0 && <p className="text-xs text-bb-text-muted">No members yet.</p>}
          </div>

          {/* Pending Invites */}
          {invites.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-bb-text-muted uppercase tracking-wider mb-2">Pending Invites</h3>
              {invites.map((i) => (
                <div key={i.id} className="flex items-center justify-between px-4 py-2.5 bg-bb-bg-secondary border border-bb-border rounded-lg mb-1.5">
                  <div className="text-xs text-bb-text-secondary truncate">{i.email}</div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-bb-text-muted uppercase">{i.role}</span>
                    <button onClick={() => handleCancelInvite(i.id)} className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-950/30 transition-colors">Cancel</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Brain Info */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Your Brain</h2>
          <div className="p-4 border border-bb-border rounded-xl bg-bb-bg-secondary">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-bb-text-muted block text-xs uppercase tracking-wide mb-1">User ID</span>
                <code className="text-bb-text-secondary font-mono text-xs break-all">{user.id}</code>
              </div>
              <div>
                <span className="text-bb-text-muted block text-xs uppercase tracking-wide mb-1">Email</span>
                <span className="text-bb-text-secondary break-all">{user.primaryEmailAddress?.emailAddress || "N/A"}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Docs */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Quick Reference</h2>
          <div className="bg-bb-bg-secondary border border-bb-border rounded-xl p-5 space-y-3">
            <div>
              <span className="text-xs text-bb-text-muted uppercase tracking-wide">Base URL</span>
              <code className="block text-sm text-bb-text-secondary font-mono mt-1 break-all">{baseUrl}</code>
            </div>
            <div>
              <span className="text-xs text-bb-text-muted uppercase tracking-wide">Auth header</span>
              <code className="block text-sm text-bb-text-secondary font-mono mt-1">Authorization: Bearer &lt;your-api-key&gt;</code>
            </div>
            <div>
              <span className="text-xs text-bb-text-muted uppercase tracking-wide">MCP endpoint</span>
              <code className="block text-sm text-bb-text-secondary font-mono mt-1">POST /api/mcp</code>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
