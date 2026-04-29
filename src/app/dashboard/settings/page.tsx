"use client";

import { useState, useEffect, FormEvent } from "react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";

interface KeyInfo {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
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
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [loading, setLoading] = useState(false);
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

  const handleCreateKey = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName || "API Key" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCreatedKey(data.api_key);
      setNewKeyName("");
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this key?")) return;
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    loadData();
  };

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

  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary">
      <header className="h-12 flex items-center justify-between px-6 border-b border-bb-border">
        <div className="flex items-center gap-3">
          <Image src="/brainbaseLogo.png" alt="Brainbase" width={24} height={24} className="rounded" priority />
          <span className="text-sm font-medium tracking-tight">brainbase</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-bb-text-muted">
          <a href="/dashboard" className="hover:text-bb-text-secondary transition-colors">← Dashboard</a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <h1 className="text-xl font-semibold">Settings</h1>

        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}

        {/* API Keys */}
        <section>
          <h2 className="text-sm font-medium text-bb-text-secondary mb-3">API Keys</h2>
          {createdKey && (
            <div className="mb-4 p-3 bg-bb-bg-secondary border border-bb-border rounded-lg">
              <p className="text-xs text-bb-text-muted mb-1">New key created — copy it now:</p>
              <code className="text-xs text-bb-accent font-mono break-all">{createdKey}</code>
              <button onClick={() => setCreatedKey(null)} className="text-[10px] text-bb-text-muted hover:text-bb-text-secondary mt-1 block">Dismiss</button>
            </div>
          )}
          <form onSubmit={handleCreateKey} className="flex items-center gap-2 mb-4">
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
              className="px-4 py-2 bg-bb-accent text-bb-bg-primary rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Create Key
            </button>
          </form>

          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between px-4 py-3 bg-bb-bg-secondary border border-bb-border rounded-lg">
                <div>
                  <div className="text-sm text-bb-text-secondary">{k.name}</div>
                  <div className="text-[10px] text-bb-text-muted font-mono">{k.key_prefix}··· · {new Date(k.created_at).toLocaleDateString()}</div>
                </div>
                <button
                  onClick={() => handleRevoke(k.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Revoke
                </button>
              </div>
            ))}
            {keys.length === 0 && <p className="text-xs text-bb-text-muted">No keys yet.</p>}
          </div>
        </section>

        {/* Sharing */}
        <section>
          <h2 className="text-sm font-medium text-bb-text-secondary mb-3">Brain Sharing</h2>
          <form onSubmit={handleInvite} className="flex items-center gap-2 mb-4">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Invite by email..."
              className="flex-1 bg-bb-bg-secondary border border-bb-border rounded-lg px-3 py-2 text-sm text-bb-text-secondary placeholder:text-bb-text-muted outline-none focus:border-bb-border-hover"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="bg-bb-bg-secondary border border-bb-border rounded-lg px-3 py-2 text-sm text-bb-text-secondary outline-none focus:border-bb-border-hover"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-bb-accent text-bb-bg-primary rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Invite
            </button>
          </form>

          {/* Members */}
          <div className="mb-4">
            <h3 className="text-xs font-medium text-bb-text-muted uppercase tracking-wider mb-2">Members</h3>
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between px-4 py-2.5 bg-bb-bg-secondary border border-bb-border rounded-lg mb-1.5">
                <div className="text-xs text-bb-text-secondary font-mono">{m.user_id.slice(0, 16)}…</div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-bb-text-muted uppercase">{m.role}</span>
                  <button onClick={() => handleRemoveMember(m.user_id)} className="text-[10px] text-red-400 hover:text-red-300">Remove</button>
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
                  <div className="text-xs text-bb-text-secondary">{i.email}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-bb-text-muted uppercase">{i.role}</span>
                    <button onClick={() => handleCancelInvite(i.id)} className="text-[10px] text-red-400 hover:text-red-300">Cancel</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
