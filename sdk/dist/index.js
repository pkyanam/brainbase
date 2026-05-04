"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrainbaseError = exports.Brainbase = void 0;
// ── Main client ─────────────────────────────────────────────────────────
class Brainbase {
    constructor(config) {
        if (!config.apiKey || typeof config.apiKey !== "string") {
            throw new BrainbaseError("apiKey is required", 0);
        }
        this.apiKey = config.apiKey;
        this.baseUrl = (config.baseUrl || "https://brainbase.belweave.ai").replace(/\/$/, "");
        this.timeoutMs = config.timeoutMs ?? 30000;
        this.brainId = config.brainId;
    }
    // ── Internal request methods ──────────────────────────────────────
    /**
     * Call an MCP tool via JSON-RPC 2.0.
     * Used for read-heavy operations: search, query, getPage, links, graph, etc.
     */
    async mcp(method, params = {}) {
        const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
        };
        if (this.brainId)
            headers["X-Brain-Id"] = this.brainId;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        let res;
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
        }
        catch (err) {
            clearTimeout(timeout);
            if (err instanceof Error && err.name === "AbortError") {
                throw new BrainbaseError(`Request timeout after ${this.timeoutMs}ms`, 408);
            }
            throw new BrainbaseError(err instanceof Error ? err.message : "Network error", 0);
        }
        finally {
            clearTimeout(timeout);
        }
        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            throw new BrainbaseError(`HTTP ${res.status}: ${text}`, res.status);
        }
        const data = (await res.json());
        if (data.error)
            throw new BrainbaseError(data.error.message, data.error.code);
        const text = data.result?.content?.[0]?.text;
        if (!text)
            return null;
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    }
    /**
     * Call a REST endpoint directly.
     * Used for operations that aren't exposed via MCP: enrich, raw data, tags, etc.
     */
    async rest(method, path, body) {
        const headers = {
            Authorization: `Bearer ${this.apiKey}`,
        };
        if (this.brainId)
            headers["X-Brain-Id"] = this.brainId;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        const fetchInit = {
            method,
            headers,
            signal: controller.signal,
        };
        if (body && method !== "GET") {
            headers["Content-Type"] = "application/json";
            fetchInit.body = JSON.stringify(body);
        }
        let res;
        try {
            res = await fetch(`${this.baseUrl}${path}`, fetchInit);
        }
        catch (err) {
            clearTimeout(timeout);
            if (err instanceof Error && err.name === "AbortError") {
                throw new BrainbaseError(`Request timeout after ${this.timeoutMs}ms`, 408);
            }
            throw new BrainbaseError(err instanceof Error ? err.message : "Network error", 0);
        }
        finally {
            clearTimeout(timeout);
        }
        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            let message = `HTTP ${res.status}: ${text}`;
            try {
                const parsed = JSON.parse(text);
                if (parsed.error)
                    message = parsed.error;
            }
            catch { /* use raw text */ }
            throw new BrainbaseError(message, res.status);
        }
        return res.json();
    }
    // ── Read operations ───────────────────────────────────────────────
    /** Full-text + ILIKE search across your brain. */
    async search(query) {
        return (await this.mcp("search", { query })) ?? [];
    }
    /** Natural language query with hybrid vector + keyword search. */
    async query(question) {
        return (await this.mcp("query", { question })) ?? [];
    }
    /** Ask a question and get a generated answer with cited sources. */
    async ask(question) {
        return this.rest("POST", "/api/ask", { question });
    }
    /** Get a specific page by slug with content, links, and timeline. */
    async getPage(slug) {
        return (await this.mcp("get_page", { slug }));
    }
    /** Get brain health dashboard. */
    async health() {
        return (await this.mcp("get_health"));
    }
    /** Get detailed brain statistics. */
    async stats() {
        return (await this.mcp("get_stats"));
    }
    /** Get full knowledge graph (nodes + edges). */
    async graph() {
        return (await this.mcp("get_graph"));
    }
    /** Get outgoing + incoming links for a page. */
    async links(slug) {
        return (await this.mcp("get_links", { slug }));
    }
    /** Get pages that link to this one. */
    async backlinks(slug) {
        return (await this.mcp("get_backlinks", { slug }));
    }
    /** Get timeline entries for a page. */
    async timeline(slug) {
        return (await this.mcp("get_timeline", { slug }));
    }
    /** List all pages with optional filters. */
    async listPages(options) {
        return (await this.mcp("list_pages", options || {}));
    }
    /** Traverse the knowledge graph from a starting page with optional type filtering. */
    async traverse(slug, options) {
        return (await this.mcp("traverse_graph", {
            slug,
            depth: options?.depth ?? 2,
            direction: options?.direction ?? "out",
            link_type: options?.linkType,
        }));
    }
    /** Get version history for a page. */
    async getVersions(slug) {
        return this.rest("GET", `/api/brain/versions/${slug}`);
    }
    /** Get activity feed for the brain. */
    async getActivity(options) {
        const params = new URLSearchParams();
        if (options?.limit)
            params.set("limit", String(options.limit));
        if (options?.action)
            params.set("action", options.action);
        const qs = params.toString();
        return this.rest("GET", `/api/brain/activity${qs ? `?${qs}` : ""}`);
    }
    /** Get stored raw data for a page. */
    async getRawData(slug, source) {
        const params = source ? `?source=${encodeURIComponent(source)}` : "";
        return this.rest("GET", `/api/brain/raw-data?slug=${encodeURIComponent(slug)}${source ? `&source=${encodeURIComponent(source)}` : ""}`);
    }
    /** Get tags for a page. */
    async getTags(slug) {
        return this.rest("GET", `/api/brain/tags?slug=${encodeURIComponent(slug)}`);
    }
    // ── Write operations ──────────────────────────────────────────────
    /** Create or update a page. */
    async putPage(input) {
        return (await this.mcp("put_page", {
            slug: input.slug,
            title: input.title,
            type: input.type,
            content: input.content,
            frontmatter: input.frontmatter,
            written_by: input.written_by,
        }));
    }
    /** Delete a page by slug. */
    async deletePage(slug) {
        return (await this.mcp("delete_page", { slug }));
    }
    /** Create a typed link between two pages. */
    async addLink(from, to, linkType, writtenBy) {
        return (await this.mcp("add_link", { from, to, link_type: linkType, written_by: writtenBy }));
    }
    /** Remove a link between two pages. */
    async removeLink(from, to) {
        return (await this.mcp("remove_link", { from, to }));
    }
    /** Add a timeline entry to a page. */
    async addTimelineEntry(slug, date, summary, options) {
        return (await this.mcp("add_timeline_entry", {
            slug, date, summary,
            detail: options?.detail,
            source: options?.source,
            written_by: options?.written_by,
        }));
    }
    /** Add a tag to a page. */
    async addTag(slug, tag) {
        return this.rest("PUT", "/api/brain/tags", { slug, tag, action: "add" });
    }
    /** Remove a tag from a page. */
    async removeTag(slug, tag) {
        return this.rest("PUT", "/api/brain/tags", { slug, tag, action: "remove" });
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
    async enrich(input) {
        return this.rest("POST", "/api/brain/enrich", {
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
    async getJob(jobId) {
        return this.rest("GET", `/api/jobs/${jobId}`);
    }
    /** List all jobs with optional status filter. */
    async listJobs(options) {
        const params = new URLSearchParams();
        if (options?.status)
            params.set("status", options.status);
        if (options?.limit)
            params.set("limit", String(options.limit));
        const qs = params.toString();
        return this.rest("GET", `/api/jobs${qs ? `?${qs}` : ""}`);
    }
    /** Retry a failed job. */
    async retryJob(jobId) {
        return this.rest("POST", `/api/jobs/${jobId}/retry`);
    }
    // ── API keys ──────────────────────────────────────────────────────
    /** Create a new API key. The full key is only returned once. */
    async createApiKey(name) {
        return this.rest("POST", "/api/keys", { name });
    }
    /** List all API keys (masked). */
    async listApiKeys() {
        return this.rest("GET", "/api/keys");
    }
    /** Revoke an API key by ID. */
    async revokeApiKey(keyId) {
        return this.rest("DELETE", `/api/keys?id=${encodeURIComponent(keyId)}`);
    }
    // ── Graph Intelligence ─────────────────────────────────────────────
    /**
     * Get PageRank centrality scores for the top pages in your brain.
     * Uses Neo4j GDS when available, falls back to degree centrality.
     */
    async pageRank(limit = 25) {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        return this.rest("GET", `/api/brain/intel/pagerank?${params}`);
    }
    /**
     * Detect communities in your brain using Louvain algorithm.
     * Requires Neo4j GDS plugin.
     */
    async communities(limit = 500) {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        return this.rest("GET", `/api/brain/intel/communities?${params}`);
    }
    /**
     * Find the shortest path between two pages.
     * Always available (pure Cypher, no plugin required).
     */
    async shortestPath(fromSlug, toSlug, maxDepth = 6) {
        const params = new URLSearchParams();
        params.set("from", fromSlug);
        params.set("to", toSlug);
        params.set("maxDepth", String(maxDepth));
        return this.rest("GET", `/api/brain/intel/shortest-path?${params}`);
    }
    /**
     * Find pages similar to a given page based on link structure.
     * Uses Neo4j GDS when available, falls back to Jaccard similarity.
     */
    async similarPages(slug, limit = 10) {
        const params = new URLSearchParams();
        params.set("slug", slug);
        params.set("limit", String(limit));
        return this.rest("GET", `/api/brain/intel/similar?${params}`);
    }
    /**
     * Trigger Postgres → Neo4j graph synchronization.
     * Ensures the Neo4j projection is up-to-date with Postgres data.
     */
    async graphSync() {
        return this.rest("POST", "/api/brain/graph-sync");
    }
}
exports.Brainbase = Brainbase;
// ── Error class ─────────────────────────────────────────────────────────
class BrainbaseError extends Error {
    constructor(message, code) {
        super(message);
        this.name = "BrainbaseError";
        this.code = code;
    }
}
exports.BrainbaseError = BrainbaseError;
//# sourceMappingURL=index.js.map