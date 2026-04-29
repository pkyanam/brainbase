"use client";

import { useState, useEffect } from "react";
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
  key_prefix: string;
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const baseUrl = useBaseUrl();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/keys")
      .then((r) => r.json())
      .then((d) => setKeys(d.keys || []))
      .catch(() => {});
  }, [isLoaded, user]);

  async function createKey() {
    setLoading(true);
    setNewKey(null);
    try {
      const res = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Production" }) });
      const data = await res.json();
      if (data.key) {
        setNewKey(data.key);
        setKeys((prev) => [
          { id: data.record.id, brain_id: data.record.brain_id, name: data.record.name, created_at: data.record.created_at, key_prefix: data.key.slice(0, 16) },
          ...prev,
        ]);
      }
    } catch (err) {
      console.error("Failed to create key:", err);
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

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-neutral-800 border-t-neutral-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-neutral-400">
        <a href="/sign-in" className="text-violet-400 hover:underline">Sign in</a> to manage your API keys.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-neutral-100">
      <Nav />

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-neutral-500 text-sm mb-8">Manage your brain and API keys.</p>

        {/* API Keys */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">API Keys</h2>
            <button
              onClick={createKey}
              disabled={loading}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? "Creating..." : "Create key"}
            </button>
          </div>

          {newKey && (
            <div className="mb-6 p-4 bg-emerald-950/30 border border-emerald-800/50 rounded-xl">
              <p className="text-sm text-emerald-400 font-medium mb-2">Key created — copy it now, you won't see it again.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-black border border-emerald-800/50 rounded-lg px-3 py-2 text-sm font-mono text-emerald-300 break-all">{newKey}</code>
                <button onClick={() => copy(newKey)} className="px-3 py-2 bg-emerald-800/30 hover:bg-emerald-800/50 text-emerald-300 text-sm rounded-lg transition-colors shrink-0">
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {keys.length === 0 ? (
            <div className="text-center py-12 border border-neutral-900 rounded-xl bg-neutral-950">
              <p className="text-neutral-500 text-sm">No API keys yet.</p>
              <p className="text-neutral-600 text-xs mt-1">Create one to start using the Brainbase API.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between p-4 border border-neutral-900 rounded-xl bg-neutral-950 hover:border-neutral-800 transition-colors">
                  <div>
                    <div className="text-sm font-medium text-neutral-200">{k.name || "Unnamed key"}</div>
                    <div className="text-xs text-neutral-600 font-mono mt-0.5">{k.key_prefix}...··· · Created {new Date(k.created_at).toLocaleDateString()}</div>
                  </div>
                  <button
                    onClick={() => revokeKey(k.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-950/30"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Brain Info */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Your Brain</h2>
          <div className="p-4 border border-neutral-900 rounded-xl bg-neutral-950">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-neutral-600 block text-xs uppercase tracking-wide mb-1">User ID</span>
                <code className="text-neutral-400 font-mono text-xs">{user.id}</code>
              </div>
              <div>
                <span className="text-neutral-600 block text-xs uppercase tracking-wide mb-1">Email</span>
                <span className="text-neutral-400">{user.primaryEmailAddress?.emailAddress || "N/A"}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Docs */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Quick Reference</h2>
          <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 space-y-3">
            <div>
              <span className="text-xs text-neutral-600 uppercase tracking-wide">Base URL</span>
              <code className="block text-sm text-neutral-300 font-mono mt-1">{baseUrl}</code>
            </div>
            <div>
              <span className="text-xs text-neutral-600 uppercase tracking-wide">Auth header</span>
              <code className="block text-sm text-neutral-300 font-mono mt-1">Authorization: Bearer bb_live_...</code>
            </div>
            <div>
              <span className="text-xs text-neutral-600 uppercase tracking-wide">MCP endpoint</span>
              <code className="block text-sm text-neutral-300 font-mono mt-1">POST /api/mcp</code>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
