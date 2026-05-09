"use client";

import { useCallback, useRef, useState } from "react";

// ─── Core Fetch ───────────────────────────────────────────

class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function fetchApi<T = unknown>(
  path: string,
  options?: RequestInit & { params?: Record<string, string | number | undefined> },
): Promise<T> {
  let url = path;
  if (options?.params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(options.params)) {
      if (v !== undefined) qs.set(k, String(v));
    }
    const str = qs.toString();
    if (str) url += `?${str}`;
  }

  const { params: _, ...init } = (options ?? {});
  if (init.body && typeof init.body === "object" && !(init.body instanceof FormData)) {
    init.headers = {
      "Content-Type": "application/json",
      ...init.headers,
    };
    init.body = JSON.stringify(init.body);
  }

  const res = await fetch(url, init);

  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { /* non-JSON body */ }
    const msg = (body && typeof body === "object" && "error" in body)
      ? String((body as Record<string, unknown>).error)
      : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, body);
  }

  // Handle non-JSON responses (blobs, SSE)
  if (res.headers.get("content-type")?.includes("text/event-stream")) {
    return res as unknown as T;
  }

  return res.json() as Promise<T>;
}

// ─── Hook — useApi ────────────────────────────────────────

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: unknown[]) => Promise<T | null>;
}

export function useApi<T>(
  fn: (...args: any[]) => Promise<T>,
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const execute = useCallback(async (...args: unknown[]): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      setData(result);
      return result;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e instanceof Error ? e.message : "Unknown error");
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, execute };
}

// ─── Typed API Functions ──────────────────────────────────

export interface BrainStats {
  page_count: number;
  chunk_count: number;
  link_count: number;
  embed_coverage: number;
  brain_score: number;
  pages_by_type: Record<string, number>;
  most_connected: { slug: string; title: string; link_count: number }[];
}

export interface SearchResult {
  slug: string;
  title: string;
  type: string;
  excerpt: string;
  score: number;
}

export interface PageDetail {
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

export interface Brain {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface Activity {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_slug: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Member {
  user_id: string;
  role: string;
  created_at: string;
}

export interface Invite {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

export interface BrainShare {
  members: Member[];
  invites: Invite[];
}

export interface ImplicitRule {
  observation: string;
  confidence: number;
  page_slug: string;
  page_title: string;
}

export interface ApiKey {
  id: string;
  brain_id: string;
  name: string | null;
  created_at: string;
  last_used_at: string | null;
  key_prefix: string;
}

export interface DreamStatus {
  brain_id: string;
  status: string;
  pages: number;
  links: number;
  orphans: number;
  stale_chunks: number;
  tiered_entities: number;
  last_extracted_at: string | null;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  linkCount: number;
  group: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

// ─── API Functions ────────────────────────────────────────

export const api = {
  // Brain
  getHealth: (brainId: string) =>
    fetchApi<BrainStats>("/api/brain/health", { params: { brain_id: brainId } }),

  getBrains: () =>
    fetchApi<{ brains: Brain[] }>("/api/brain/brains"),

  deleteBrain: (brainId: string) =>
    fetchApi<void>("/api/brain/brains", { method: "DELETE", params: { brain_id: brainId } }),

  getActivity: (brainId: string) =>
    fetchApi<{ activities: Activity[] }>("/api/brain/activity", { params: { brain_id: brainId } }),

  getShare: (brainId?: string) =>
    fetchApi<BrainShare>("/api/brain/share", brainId ? { params: { brain_id: brainId } } : {}),

  inviteMember: (email: string, role: "editor" | "viewer") =>
    fetchApi("/api/brain/share", { method: "POST", body: { email, role } as unknown as BodyInit }),

  removeMember: (userId: string) =>
    fetchApi("/api/brain/share", { method: "DELETE", params: { user_id: userId } }),

  cancelInvite: (inviteId: string) =>
    fetchApi("/api/brain/share", { method: "DELETE", params: { invite_id: inviteId } }),

  search: (query: string, brainId: string) =>
    fetchApi<SearchResult[]>("/api/brain/search", { params: { q: query, brain_id: brainId } }),

  getPage: (slug: string, brainId?: string) =>
    fetchApi<PageDetail>(`/api/brain/page/${encodeURIComponent(slug)}`, brainId ? { params: { brain_id: brainId } } : {}),

  seed: (brainId: string) =>
    fetchApi<{ status: string; pages_created: number; links_created: number }>("/api/brain/seed", { method: "POST", params: { brain_id: brainId } }),

  getImplicitRules: (brainId: string) =>
    fetchApi<{ rules: ImplicitRule[] }>("/api/brain/implicit-rules", { params: { brain_id: brainId } }),

  getDream: (brainId: string) =>
    fetchApi<DreamStatus>("/api/brain/dream", { params: { brain_id: brainId } }),

  runDream: (brainId: string) =>
    fetchApi<{ error?: string }>("/api/brain/dream", { method: "POST", params: { brain_id: brainId }, body: { process_all: true } as unknown as BodyInit }),

  getGraph: () =>
    fetchApi<{ nodes: GraphNode[]; edges: GraphEdge[] }>("/api/brain/graph"),

  // Pages
  createPage: (data: { slug: string; title: string; type: string; content?: string }) =>
    fetchApi<{ title: string }>("/api/pages", { method: "POST", body: data as unknown as BodyInit }),

  // API Keys
  getKeys: () =>
    fetchApi<{ keys: ApiKey[] }>("/api/keys"),

  createKey: (name: string) =>
    fetchApi<{ key: string; record: { id: string; brain_id: string; name: string; created_at: string } }>("/api/keys", { method: "POST", body: { name } as unknown as BodyInit }),

  deleteKey: (keyId: string) =>
    fetchApi("/api/keys", { method: "DELETE", params: { id: keyId } }),

  // Ask
  ask: (q: string) =>
    fetchApi<{ answer: string; confidence: number; intent: string; searchedAt: string; sources: { slug: string; title: string; type: string; excerpt: string; relevance: number }[] }>("/api/ask", { method: "POST", body: { q } as unknown as BodyInit }),

  // Integrations
  ingestSlack: (botToken: string, teamId: string) =>
    fetchApi<{ messages_fetched: number; pages_created: number; decisions_detected: number; error?: string }>("/api/ingest/slack", { method: "POST", body: { botToken, teamId } as unknown as BodyInit }),

  ingestGitHub: (token: string, repos?: string) =>
    fetchApi<{ items_fetched: number; pages_created: number; links_created: number; error?: string }>("/api/ingest/github", { method: "POST", body: { token, repos } as unknown as BodyInit }),

  // Billing
  getUsage: () =>
    fetchApi<{ plan: string; usage: { pages: { used: number; limit: number }; searches: { used: number; limit: number }; apiCalls: { used: number; limit: number } } }>("/api/billing/usage"),

  startCheckout: () =>
    fetchApi<{ url: string }>("/api/billing/checkout", { method: "POST" }),

  // Graph intelligence
  pagerank: (limit = 25) =>
    fetchApi<{ algorithm: string; reason?: string; results: { slug: string; title: string; type: string; score: number }[] }>("/api/brain/intel/pagerank", { params: { limit } }),

  communities: (limit = 500) =>
    fetchApi<{ available: boolean; reason?: string; community_count: number; results: { slug: string; title: string; type: string; community_id: number }[] }>("/api/brain/intel/communities", { params: { limit } }),

  shortestPath: (from: string, to: string) =>
    fetchApi<{ found: boolean; length: number; hops: { slug: string; title: string; type: string; link_type?: string }[] }>("/api/brain/intel/shortest-path", { params: { from, to } }),

  similar: (slug: string, limit = 10) =>
    fetchApi<{ algorithm: string; reason?: string; results: { slug: string; title: string; type: string; similarity: number }[] }>("/api/brain/intel/similar", { params: { slug, limit } }),

  // Wiki
  getWiki: () =>
    fetchApi<{ brain_id: string; slug: string; name: string; wiki: { enabled: boolean; title: string | null; tagline: string | null; public_url: string | null }; counts: { public: number; total: number } }>("/api/brain/wiki"),

  updateWiki: (data: Partial<{ enabled: boolean; title: string; tagline: string }>) =>
    fetchApi("/api/brain/wiki", { method: "POST", body: data as unknown as BodyInit }),

  updateWikiPage: (slug: string, isPublic: boolean) =>
    fetchApi("/api/brain/wiki/page", { method: "POST", body: { slug, public: isPublic } as unknown as BodyInit }),

  // Webhooks
  getWebhooks: () =>
    fetchApi<{ webhooks: { id: string; url: string; events: string[]; enabled: boolean; description: string; last_delivery_at: string; last_delivery_status: string; last_delivery_error: string; delivery_count: number; failure_count: number; created_at: string }[] }>("/api/brain/webhooks"),

  createWebhook: (data: { url: string; events: string[]; description?: string }) =>
    fetchApi<{ id: string; secret: string }>("/api/brain/webhooks", { method: "POST", body: data as unknown as BodyInit }),

  deleteWebhook: (id: string) =>
    fetchApi("/api/brain/webhooks", { method: "DELETE", params: { id } }),

  // Eval export
  exportEval: (since: string, limit?: number) =>
    fetchApi<Blob>("/api/eval/export", { params: { since, limit } }),

  // Admin
  getApplications: (limit = 50, offset = 0) =>
    fetchApi<{ applications: { id: string; name: string; email: string; company: string; team_size: string; message: string; source: string; created_at: string }[]; total: number }>("/api/admin/applications", { params: { limit, offset } }),

  // Apply
  submitApplication: (data: { name: string; email: string; company: string; team_size: string; message: string }) =>
    fetchApi("/api/apply", { method: "POST", body: data as unknown as BodyInit }),
};

export { ApiError };
