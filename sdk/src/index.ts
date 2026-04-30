/**
 * Brainbase SDK — the API layer for AI agent memory.
 *
 * @example
 * ```ts
 * import { Brainbase } from "brainbase-sdk";
 *
 * const brain = new Brainbase({ apiKey: "bb_live_...", baseUrl: "https://brainbase.belweave.ai" });
 * const result = await brain.search("garry tan");
 * const page = await brain.getPage("people/garry-tan");
 * const health = await brain.health();
 * ```
 */

export interface BrainbaseConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
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
  frontmatter: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  links?: {
    outgoing: { slug: string; title: string; type: string; link_type: string }[];
    incoming: { slug: string; title: string; type: string; link_type: string }[];
  };
  timeline?: { date: string; summary: string; detail?: string; source?: string }[];
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

export class Brainbase {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: BrainbaseConfig) {
    if (!config.apiKey || typeof config.apiKey !== "string") {
      throw new BrainbaseError("apiKey is required", 0);
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || "http://localhost:5174").replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? 30000;
  }

  private async request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
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

    if (data.error) {
      throw new BrainbaseError(data.error.message, data.error.code);
    }

    const text = data.result?.content?.[0]?.text;
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  // ── Read operations ──

  /** Search your brain by keyword or natural language. */
  async search(query: string): Promise<SearchResult[]> {
    const result = await this.request("search", { query });
    return (result as SearchResult[]) ?? [];
  }

  /** Ask a natural language question. */
  async query(question: string): Promise<SearchResult[]> {
    const result = await this.request("query", { question });
    return (result as SearchResult[]) ?? [];
  }

  /** Get a specific page by slug. */
  async getPage(slug: string): Promise<PageDetail | null> {
    const result = await this.request("get_page", { slug });
    return result as PageDetail | null;
  }

  /** Get brain statistics. */
  async health(): Promise<BrainHealth | null> {
    const result = await this.request("get_health");
    return result as BrainHealth | null;
  }

  /** Get detailed brain statistics (alias for health). */
  async stats(): Promise<BrainHealth | null> {
    const result = await this.request("get_stats");
    return result as BrainHealth | null;
  }

  /** Get full knowledge graph data. */
  async graph(): Promise<GraphData | null> {
    const result = await this.request("get_graph");
    return result as GraphData | null;
  }

  /** Get links for a page. */
  async links(slug: string): Promise<PageLinks | null> {
    const result = await this.request("get_links", { slug });
    return result as PageLinks | null;
  }

  /** Get backlinks (pages that link to this one). */
  async backlinks(slug: string): Promise<{ slug: string; title: string; type: string; link_type: string }[] | null> {
    const result = await this.request("get_backlinks", { slug });
    return result as { slug: string; title: string; type: string; link_type: string }[] | null;
  }

  /** Get timeline entries for a page. */
  async timeline(slug: string): Promise<TimelineEntry[] | null> {
    const result = await this.request("get_timeline", { slug });
    return result as TimelineEntry[] | null;
  }

  /** List all pages with optional type filter. */
  async listPages(options?: { type?: string; writtenBy?: string; limit?: number; offset?: number }): Promise<PageListItem[] | null> {
    const result = await this.request("list_pages", options || {});
    return result as PageListItem[] | null;
  }

  /** Traverse the knowledge graph from a starting page. */
  async traverse(slug: string, options?: { depth?: number; direction?: "out" | "in" | "both" }): Promise<TraversalResult[] | null> {
    const result = await this.request("traverse_graph", {
      slug,
      depth: options?.depth ?? 2,
      direction: options?.direction ?? "out",
    });
    return result as TraversalResult[] | null;
  }

  // ── Write operations ──

  /** Create or update a page. */
  async putPage(input: PutPageInput): Promise<PutPageResult | null> {
    const result = await this.request("put_page", {
      slug: input.slug,
      title: input.title,
      type: input.type,
      content: input.content,
      frontmatter: input.frontmatter,
      written_by: input.written_by,
    });
    return result as PutPageResult | null;
  }

  /** Delete a page by slug. */
  async deletePage(slug: string): Promise<{ success: boolean; slug: string } | null> {
    const result = await this.request("delete_page", { slug });
    return result as { success: boolean; slug: string } | null;
  }

  /** Create a typed link between two pages. */
  async addLink(from: string, to: string, linkType?: string, writtenBy?: string): Promise<{ success: boolean; from: string; to: string; link_type: string } | null> {
    const result = await this.request("add_link", { from, to, link_type: linkType, written_by: writtenBy });
    return result as { success: boolean; from: string; to: string; link_type: string } | null;
  }

  /** Remove a link between two pages. */
  async removeLink(from: string, to: string): Promise<{ success: boolean; from: string; to: string } | null> {
    const result = await this.request("remove_link", { from, to });
    return result as { success: boolean; from: string; to: string } | null;
  }

  /** Add a timeline entry to a page. */
  async addTimelineEntry(
    slug: string,
    date: string,
    summary: string,
    options?: { detail?: string; source?: string; written_by?: string }
  ): Promise<{ id: string } | null> {
    const result = await this.request("add_timeline_entry", {
      slug,
      date,
      summary,
      detail: options?.detail,
      source: options?.source,
      written_by: options?.written_by,
    });
    return result as { id: string } | null;
  }
}

export class BrainbaseError extends Error {
  code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = "BrainbaseError";
    this.code = code;
  }
}
