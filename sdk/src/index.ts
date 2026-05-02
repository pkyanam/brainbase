/**
 * Brainbase SDK — the API layer for AI agent memory.
 *
 * @example
 * ```ts
 * import { Brainbase } from "brainbase-sdk";
 *
 * const brain = new Brainbase({ apiKey: "bb_live_..." });
 * const results = await brain.search("garry tan");
 * const page = await brain.getPage("people/garry-tan");
 * const health = await brain.health();
 * ```
 *
 * @example Enrichment
 * ```ts
 * const result = await brain.enrich({
 *   name: "Satya Nadella",
 *   type: "person",
 *   tier: 2,
 * });
 * // result.sources === ["brave", "openai"]
 * // result._diag.braveResults === 5
 * ```
 */

// ── Configuration ───────────────────────────────────────────────────────

export interface BrainbaseConfig {
  /** API key (bb_live_...). Required for remote endpoints. */
  apiKey: string;
  /** Base URL. Defaults to https://brainbase.belweave.ai */
  baseUrl?: string;
  /** Request timeout in milliseconds. Default 30_000. */
  timeoutMs?: number;
  /** Target brain ID for multi-tenant setups. */
  brainId?: string;
}

// ── Read operation types ────────────────────────────────────────────────

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
  frontmatter: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  links?: {
    outgoing: { slug: string; title: string; type: string; link_type: string }[];
    incoming: { slug: string; title: string; type: string; link_type: string }[];
  };
  timeline?: TimelineEntry[];
}

export interface BrainHealth {
  page_count: number;
  chunk_count: number;
  link_count: number;
  embed_coverage: number;
  brain_score: number;
  pages_by_type: Record<string, number>;
  most_connected: { slug: string; title: string; link_count: number }[];
}

export interface GraphData {
  nodes: { id: string; label: string; type: string; linkCount: number; group: number }[];
  edges: { source: string; target: string; type: string }[];
}

export interface PageLinks {
  outgoing: { slug: string; title: string; type: string; link_type: string }[];
  incoming: { slug: string; title: string; type: string; link_type: string }[];
}

export interface TimelineEntry {
  date: string;
  summary: string;
  detail?: string;
  source?: string;
}

export interface PageListItem {
  slug: string;
  title: string;
  type: string;
  updated_at: string;
}

export interface TraversalResult {
  slug: string;
  title: string;
  type: string;
  depth: number;
  link_type?: string;
}

// ── Write operation types ───────────────────────────────────────────────

export interface PutPageInput {
  slug: string;
  title: string;
  type?: string;
  content?: string;
  frontmatter?: Record<string, unknown>;
  written_by?: string;
}

export interface PutPageResult {
  slug: string;
  title: string;
  type: string;
  content: string;
  frontmatter: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Enrichment types ────────────────────────────────────────────────────

export type EnrichTier = 1 | 2 | 3;
export type EnrichEntityType = "person" | "company" | "auto";

export interface EnrichInput {
  /** Entity name (e.g. "Satya Nadella", "Stripe") */
  name: string;
  /** Entity type, or "auto" for heuristic detection */
  type?: EnrichEntityType;
  /** Enrichment tier: 1=full (async), 2=standard (sync, Brave+OpenAI), 3=light (sync, OpenAI only) */
  tier?: EnrichTier;
  /** Free text context about the entity — woven into the compiled truth (1.6-1.9x richer pages) */
  context?: string;
  /** Force re-enrich even if page was updated within 7 days */
  force?: boolean;
  /** Process asynchronously via job queue (default: auto — Tier 1 always async, 2-3 sync) */
  async?: boolean;
}

export interface EnrichResult {
  slug: string;
  title: string;
  type: string;
  action: "created" | "updated" | "skipped";
  compiledTruth: string;
  sources: string[];
  newSignals: string[];
  enrichedAt: string;
  linksCreated: number;
  rawDataStored: number;
  _diag?: {
    braveKeyConfigured: boolean;
    braveKeyLength: number;
    braveCalled: boolean;
    braveResults: number;
    braveError?: string;
  };
}

export interface EnrichQueued {
  queued: true;
  jobId: number;
  tier: number;
  message: string;
}

// ── Raw data types ──────────────────────────────────────────────────────

export interface RawDataEntry {
  source: string;
  data: unknown;
  created_at: string;
}

// ── Tags types ──────────────────────────────────────────────────────────

export interface TagsResult {
  tags: string[];
}

// ── Versions types ──────────────────────────────────────────────────────

export interface VersionEntry {
  id: number;
  slug: string;
  title: string;
  type: string;
  author: string;
  created_at: string;
}

// ── Activity types ──────────────────────────────────────────────────────

export interface ActivityEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_slug: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── API key types ───────────────────────────────────────────────────────

export interface ApiKeyResult {
  id: string;
  key: string;
  name: string;
  created_at: string;
  last_used_at?: string;
}

export interface ApiKeyCreated {
  id: string;
  key: string; // full key — only shown once
  name: string;
  created_at: string;
}

// ── Job types ───────────────────────────────────────────────────────────

export interface JobStatus {
  id: number;
  name: string;
  status: "waiting" | "active" | "completed" | "failed" | "delayed" | "dead" | "cancelled";
  progress?: number;
  result?: unknown;
  error?: string;
}

// ── Ask types ───────────────────────────────────────────────────────────

export interface AskResult {
  answer: string;
  sources: { slug: string; title: string; excerpt: string }[];
  confidence: number;
}

// ── Main client ─────────────────────────────────────────────────────────

export class Brainbase {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private brainId?: string;

  constructor(config: BrainbaseConfig) {
    if (!config.apiKey || typeof config.apiKey !== "string") {
      throw new BrainbaseError("apiKey is required", 0);
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || "https://brainbase.belweave.ai").replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.brainId = config.brainId;
  }

  // ── Internal request methods ──────────────────────────────────────

  /**
   * Call an MCP tool via JSON-RPC 2.0.
   * Used for read-heavy operations: search, query, getPage, links, graph, etc.
   */
  private async mcp(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.brainId) headers["X-Brain-Id"] = this.brainId;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/mcp`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: { name: method, arguments: params },
          id: Date.now(),
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        throw new BrainbaseError(`Request timeout after ${this.timeoutMs}ms`, 408);
      }
      throw new BrainbaseError(err instanceof Error ? err.message : "Network error", 0);
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new BrainbaseError(`HTTP ${res.status}: ${text}`, res.status);
    }

    const data = (await res.json()) as {
      error?: { message: string; code: number };
      result?: { content?: { type: string; text: string }[] };
    };

    if (data.error) throw new BrainbaseError(data.error.message, data.error.code);

    const text = data.result?.content?.[0]?.text;
    if (!text) return null;

    try { return JSON.parse(text); } catch { return text; }
  }

  /**
   * Call a REST endpoint directly.
   * Used for operations that aren't exposed via MCP: enrich, raw data, tags, etc.
   */
  private async rest<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.brainId) headers["X-Brain-Id"] = this.brainId;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const fetchInit: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body && method !== "GET") {
      headers["Content-Type"] = "application/json";
      fetchInit.body = JSON.stringify(body);
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, fetchInit);
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        throw new BrainbaseError(`Request timeout after ${this.timeoutMs}ms`, 408);
      }
      throw new BrainbaseError(err instanceof Error ? err.message : "Network error", 0);
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      let message = `HTTP ${res.status}: ${text}`;
      try {
        const parsed = JSON.parse(text);
        if (parsed.error) message = parsed.error;
      } catch { /* use raw text */ }
      throw new BrainbaseError(message, res.status);
    }

    return res.json() as Promise<T>;
  }

  // ── Read operations ───────────────────────────────────────────────

  /** Full-text + ILIKE search across your brain. */
  async search(query: string): Promise<SearchResult[]> {
    return ((await this.mcp("search", { query })) as SearchResult[]) ?? [];
  }

  /** Natural language query with hybrid vector + keyword search. */
  async query(question: string): Promise<SearchResult[]> {
    return ((await this.mcp("query", { question })) as SearchResult[]) ?? [];
  }

  /** Ask a question and get a generated answer with cited sources. */
  async ask(question: string): Promise<AskResult | null> {
    return this.rest<AskResult>("POST", "/api/ask", { question });
  }

  /** Get a specific page by slug with content, links, and timeline. */
  async getPage(slug: string): Promise<PageDetail | null> {
    return (await this.mcp("get_page", { slug })) as PageDetail | null;
  }

  /** Get brain health dashboard. */
  async health(): Promise<BrainHealth | null> {
    return (await this.mcp("get_health")) as BrainHealth | null;
  }

  /** Get detailed brain statistics. */
  async stats(): Promise<BrainHealth | null> {
    return (await this.mcp("get_stats")) as BrainHealth | null;
  }

  /** Get full knowledge graph (nodes + edges). */
  async graph(): Promise<GraphData | null> {
    return (await this.mcp("get_graph")) as GraphData | null;
  }

  /** Get outgoing + incoming links for a page. */
  async links(slug: string): Promise<PageLinks | null> {
    return (await this.mcp("get_links", { slug })) as PageLinks | null;
  }

  /** Get pages that link to this one. */
  async backlinks(slug: string): Promise<{ slug: string; title: string; type: string; link_type: string }[] | null> {
    return (await this.mcp("get_backlinks", { slug })) as { slug: string; title: string; type: string; link_type: string }[] | null;
  }

  /** Get timeline entries for a page. */
  async timeline(slug: string): Promise<TimelineEntry[] | null> {
    return (await this.mcp("get_timeline", { slug })) as TimelineEntry[] | null;
  }

  /** List all pages with optional filters. */
  async listPages(options?: { type?: string; writtenBy?: string; limit?: number; offset?: number }): Promise<PageListItem[] | null> {
    return (await this.mcp("list_pages", options || {})) as PageListItem[] | null;
  }

  /** Traverse the knowledge graph from a starting page. */
  async traverse(slug: string, options?: { depth?: number; direction?: "out" | "in" | "both" }): Promise<TraversalResult[] | null> {
    return (await this.mcp("traverse_graph", {
      slug,
      depth: options?.depth ?? 2,
      direction: options?.direction ?? "out",
    })) as TraversalResult[] | null;
  }

  /** Get version history for a page. */
  async getVersions(slug: string): Promise<VersionEntry[] | null> {
    return this.rest<VersionEntry[]>("GET", `/api/brain/versions/${slug}`);
  }

  /** Get activity feed for the brain. */
  async getActivity(options?: { limit?: number; action?: string }): Promise<ActivityEntry[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.action) params.set("action", options.action);
    const qs = params.toString();
    return this.rest<ActivityEntry[]>("GET", `/api/brain/activity${qs ? `?${qs}` : ""}`);
  }

  /** Get stored raw data for a page. */
  async getRawData(slug: string, source?: string): Promise<RawDataEntry[]> {
    const params = source ? `?source=${encodeURIComponent(source)}` : "";
    return this.rest<RawDataEntry[]>("GET", `/api/brain/raw-data?slug=${encodeURIComponent(slug)}${source ? `&source=${encodeURIComponent(source)}` : ""}`);
  }

  /** Get tags for a page. */
  async getTags(slug: string): Promise<TagsResult | null> {
    return this.rest<TagsResult>("GET", `/api/brain/tags?slug=${encodeURIComponent(slug)}`);
  }

  // ── Write operations ──────────────────────────────────────────────

  /** Create or update a page. */
  async putPage(input: PutPageInput): Promise<PutPageResult | null> {
    return (await this.mcp("put_page", {
      slug: input.slug,
      title: input.title,
      type: input.type,
      content: input.content,
      frontmatter: input.frontmatter,
      written_by: input.written_by,
    })) as PutPageResult | null;
  }

  /** Delete a page by slug. */
  async deletePage(slug: string): Promise<{ success: boolean; slug: string } | null> {
    return (await this.mcp("delete_page", { slug })) as { success: boolean; slug: string } | null;
  }

  /** Create a typed link between two pages. */
  async addLink(from: string, to: string, linkType?: string, writtenBy?: string): Promise<{ success: boolean; from: string; to: string; link_type: string } | null> {
    return (await this.mcp("add_link", { from, to, link_type: linkType, written_by: writtenBy })) as { success: boolean; from: string; to: string; link_type: string } | null;
  }

  /** Remove a link between two pages. */
  async removeLink(from: string, to: string): Promise<{ success: boolean; from: string; to: string } | null> {
    return (await this.mcp("remove_link", { from, to })) as { success: boolean; from: string; to: string } | null;
  }

  /** Add a timeline entry to a page. */
  async addTimelineEntry(
    slug: string,
    date: string,
    summary: string,
    options?: { detail?: string; source?: string; written_by?: string }
  ): Promise<{ id: string } | null> {
    return (await this.mcp("add_timeline_entry", {
      slug, date, summary,
      detail: options?.detail,
      source: options?.source,
      written_by: options?.written_by,
    })) as { id: string } | null;
  }

  /** Add a tag to a page. */
  async addTag(slug: string, tag: string): Promise<{ tags: string[] }> {
    return this.rest<{ tags: string[] }>("PUT", "/api/brain/tags", { slug, tag, action: "add" });
  }

  /** Remove a tag from a page. */
  async removeTag(slug: string, tag: string): Promise<{ tags: string[] }> {
    return this.rest<{ tags: string[] }>("PUT", "/api/brain/tags", { slug, tag, action: "remove" });
  }

  // ── Enrichment ────────────────────────────────────────────────────

  /**
   * Enrich a person or company page.
   *
   * Tier 1: Full deep research — async minion job (returns { queued, jobId }).
   * Tier 2: Standard — sync, Brave web search + OpenAI formatting (<10s).
   * Tier 3: Quick lookup — sync, OpenAI only (<5s).
   *
   * @example
   * ```ts
   * const result = await brain.enrich({ name: "Satya Nadella", type: "person", tier: 2 });
   * // result.sources === ["brave", "openai"]
   * // result._diag?.braveResults === 5
   * ```
   */
  async enrich(input: EnrichInput): Promise<EnrichResult | EnrichQueued> {
    return this.rest<EnrichResult | EnrichQueued>("POST", "/api/brain/enrich", {
      name: input.name,
      type: input.type || "auto",
      tier: input.tier ?? 2,
      context: input.context,
      force: input.force,
      async: input.async,
    });
  }

  // ── Jobs ──────────────────────────────────────────────────────────

  /** Get job status by ID. */
  async getJob(jobId: number): Promise<JobStatus | null> {
    return this.rest<JobStatus>("GET", `/api/jobs/${jobId}`);
  }

  /** List all jobs with optional status filter. */
  async listJobs(options?: { status?: string; limit?: number }): Promise<JobStatus[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.limit) params.set("limit", String(options.limit));
    const qs = params.toString();
    return this.rest<JobStatus[]>("GET", `/api/jobs${qs ? `?${qs}` : ""}`);
  }

  /** Retry a failed job. */
  async retryJob(jobId: number): Promise<{ success: boolean }> {
    return this.rest<{ success: boolean }>("POST", `/api/jobs/${jobId}/retry`);
  }

  // ── API keys ──────────────────────────────────────────────────────

  /** Create a new API key. The full key is only returned once. */
  async createApiKey(name: string): Promise<ApiKeyCreated> {
    return this.rest<ApiKeyCreated>("POST", "/api/keys", { name });
  }

  /** List all API keys (masked). */
  async listApiKeys(): Promise<ApiKeyResult[]> {
    return this.rest<ApiKeyResult[]>("GET", "/api/keys");
  }

  /** Revoke an API key by ID. */
  async revokeApiKey(keyId: string): Promise<{ success: boolean }> {
    return this.rest<{ success: boolean }>("DELETE", `/api/keys?id=${encodeURIComponent(keyId)}`);
  }
}

// ── Error class ─────────────────────────────────────────────────────────

export class BrainbaseError extends Error {
  code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = "BrainbaseError";
    this.code = code;
  }
}
