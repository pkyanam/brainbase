"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Nav from "@/components/Nav";

interface Application {
  id: string;
  name: string;
  email: string;
  company: string | null;
  team_size: string | null;
  message: string | null;
  source: string;
  created_at: string;
}

export default function AdminClient() {
  const { user, isLoaded } = useUser();
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  useEffect(() => {
    if (!isLoaded || !user) return;
    loadApps();
  }, [isLoaded, user, offset]);

  async function loadApps() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications?limit=${limit}&offset=${offset}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setApplications(data.applications || []);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
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
        <a href="/sign-in" className="text-bb-accent hover:underline">Sign in</a>
        <span className="ml-1">to access admin.</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary flex flex-col">
      <Nav />

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-5 md:px-6 py-10 md:py-14">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">Applications</h1>
              <p className="text-bb-text-secondary text-sm">
                {total} total application{total !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={loadApps}
              disabled={loading}
              className="h-9 px-4 bg-bb-surface hover:bg-bb-surface-hover border border-bb-border text-bb-text-secondary text-xs rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 bg-bb-surface border border-bb-danger/40 rounded-lg text-xs text-bb-danger">
              {error}
            </div>
          )}

          {applications.length === 0 && !loading ? (
            <div className="text-center py-16 border border-dashed border-bb-border rounded-lg bg-bb-bg-secondary">
              <p className="text-sm text-bb-text-primary font-medium">No applications yet</p>
              <p className="text-xs text-bb-text-muted mt-1">Applications from /apply will appear here.</p>
            </div>
          ) : (
            <>
              <div className="border border-bb-border rounded-lg overflow-hidden bg-bb-bg-secondary">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-bb-border bg-bb-bg-primary">
                        <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-bb-text-muted font-medium">Name</th>
                        <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-bb-text-muted font-medium">Email</th>
                        <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-bb-text-muted font-medium">Company</th>
                        <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-bb-text-muted font-medium">Team</th>
                        <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-bb-text-muted font-medium">Source</th>
                        <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-bb-text-muted font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bb-border">
                      {applications.map((app) => (
                        <tr key={app.id} className="hover:bg-bb-surface/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-bb-text-primary">{app.name}</td>
                          <td className="px-4 py-3 text-bb-text-secondary font-mono text-xs">{app.email}</td>
                          <td className="px-4 py-3 text-bb-text-secondary">{app.company || "—"}</td>
                          <td className="px-4 py-3 text-bb-text-secondary">{app.team_size || "—"}</td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 border border-bb-border rounded text-bb-text-muted">
                              {app.source}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-bb-text-muted text-xs">{formatDate(app.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {total > limit && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-bb-text-muted">
                    Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setOffset((o) => Math.max(0, o - limit))}
                      disabled={offset === 0}
                      className="h-8 px-3 bg-bb-surface border border-bb-border rounded-md text-xs text-bb-text-secondary hover:text-bb-text-primary disabled:opacity-50 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setOffset((o) => o + limit)}
                      disabled={offset + limit >= total}
                      className="h-8 px-3 bg-bb-surface border border-bb-border rounded-md text-xs text-bb-text-secondary hover:text-bb-text-primary disabled:opacity-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
