"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrainbaseError = exports.Brainbase = void 0;
class Brainbase {
    constructor(config) {
        if (!config.apiKey || typeof config.apiKey !== "string") {
            throw new BrainbaseError("apiKey is required", 0);
        }
        this.apiKey = config.apiKey;
        this.baseUrl = (config.baseUrl || "http://localhost:5174").replace(/\/$/, "");
        this.timeoutMs = config.timeoutMs ?? 30000;
    }
    async request(method, params = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        let res;
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
        if (data.error) {
            throw new BrainbaseError(data.error.message, data.error.code);
        }
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
    // ── Read operations ──
    /** Search your brain by keyword or natural language. */
    async search(query) {
        const result = await this.request("search", { query });
        return result ?? [];
    }
    /** Ask a natural language question. */
    async query(question) {
        const result = await this.request("query", { question });
        return result ?? [];
    }
    /** Get a specific page by slug. */
    async getPage(slug) {
        const result = await this.request("get_page", { slug });
        return result;
    }
    /** Get brain statistics. */
    async health() {
        const result = await this.request("get_health");
        return result;
    }
    /** Get detailed brain statistics (alias for health). */
    async stats() {
        const result = await this.request("get_stats");
        return result;
    }
    /** Get full knowledge graph data. */
    async graph() {
        const result = await this.request("get_graph");
        return result;
    }
    /** Get links for a page. */
    async links(slug) {
        const result = await this.request("get_links", { slug });
        return result;
    }
    /** Get backlinks (pages that link to this one). */
    async backlinks(slug) {
        const result = await this.request("get_backlinks", { slug });
        return result;
    }
    /** Get timeline entries for a page. */
    async timeline(slug) {
        const result = await this.request("get_timeline", { slug });
        return result;
    }
    /** List all pages with optional type filter. */
    async listPages(options) {
        const result = await this.request("list_pages", options || {});
        return result;
    }
    /** Traverse the knowledge graph from a starting page. */
    async traverse(slug, options) {
        const result = await this.request("traverse_graph", {
            slug,
            depth: options?.depth ?? 2,
            direction: options?.direction ?? "out",
        });
        return result;
    }
    // ── Write operations ──
    /** Create or update a page. */
    async putPage(input) {
        const result = await this.request("put_page", {
            slug: input.slug,
            title: input.title,
            type: input.type,
            content: input.content,
            frontmatter: input.frontmatter,
            written_by: input.written_by,
        });
        return result;
    }
    /** Delete a page by slug. */
    async deletePage(slug) {
        const result = await this.request("delete_page", { slug });
        return result;
    }
    /** Create a typed link between two pages. */
    async addLink(from, to, linkType, writtenBy) {
        const result = await this.request("add_link", { from, to, link_type: linkType, written_by: writtenBy });
        return result;
    }
    /** Remove a link between two pages. */
    async removeLink(from, to) {
        const result = await this.request("remove_link", { from, to });
        return result;
    }
    /** Add a timeline entry to a page. */
    async addTimelineEntry(slug, date, summary, options) {
        const result = await this.request("add_timeline_entry", {
            slug,
            date,
            summary,
            detail: options?.detail,
            source: options?.source,
            written_by: options?.written_by,
        });
        return result;
    }
}
exports.Brainbase = Brainbase;
class BrainbaseError extends Error {
    constructor(message, code) {
        super(message);
        this.name = "BrainbaseError";
        this.code = code;
    }
}
exports.BrainbaseError = BrainbaseError;
//# sourceMappingURL=index.js.map