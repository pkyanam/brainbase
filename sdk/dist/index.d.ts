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
        outgoing: {
            slug: string;
            title: string;
            type: string;
            link_type: string;
        }[];
        incoming: {
            slug: string;
            title: string;
            type: string;
            link_type: string;
        }[];
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
    most_connected: {
        slug: string;
        title: string;
        link_count: number;
    }[];
}
export interface GraphData {
    nodes: {
        id: string;
        label: string;
        type: string;
        linkCount: number;
        group: number;
    }[];
    edges: {
        source: string;
        target: string;
        type: string;
    }[];
}
export interface PageLinks {
    outgoing: {
        slug: string;
        title: string;
        type: string;
        link_type: string;
    }[];
    incoming: {
        slug: string;
        title: string;
        type: string;
        link_type: string;
    }[];
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
export interface RawDataEntry {
    source: string;
    data: unknown;
    created_at: string;
}
export interface TagsResult {
    tags: string[];
}
export interface VersionEntry {
    id: number;
    slug: string;
    title: string;
    type: string;
    author: string;
    created_at: string;
}
export interface ActivityEntry {
    id: number;
    action: string;
    entity_type: string;
    entity_slug: string;
    metadata: Record<string, unknown>;
    created_at: string;
}
export interface ApiKeyResult {
    id: string;
    key: string;
    name: string;
    created_at: string;
    last_used_at?: string;
}
export interface ApiKeyCreated {
    id: string;
    key: string;
    name: string;
    created_at: string;
}
export interface JobStatus {
    id: number;
    name: string;
    status: "waiting" | "active" | "completed" | "failed" | "delayed" | "dead" | "cancelled";
    progress?: number;
    result?: unknown;
    error?: string;
}
export interface AskResult {
    answer: string;
    sources: {
        slug: string;
        title: string;
        excerpt: string;
    }[];
    confidence: number;
}
export declare class Brainbase {
    private apiKey;
    private baseUrl;
    private timeoutMs;
    private brainId?;
    constructor(config: BrainbaseConfig);
    /**
     * Call an MCP tool via JSON-RPC 2.0.
     * Used for read-heavy operations: search, query, getPage, links, graph, etc.
     */
    private mcp;
    /**
     * Call a REST endpoint directly.
     * Used for operations that aren't exposed via MCP: enrich, raw data, tags, etc.
     */
    private rest;
    /** Full-text + ILIKE search across your brain. */
    search(query: string): Promise<SearchResult[]>;
    /** Natural language query with hybrid vector + keyword search. */
    query(question: string): Promise<SearchResult[]>;
    /** Ask a question and get a generated answer with cited sources. */
    ask(question: string): Promise<AskResult | null>;
    /** Get a specific page by slug with content, links, and timeline. */
    getPage(slug: string): Promise<PageDetail | null>;
    /** Get brain health dashboard. */
    health(): Promise<BrainHealth | null>;
    /** Get detailed brain statistics. */
    stats(): Promise<BrainHealth | null>;
    /** Get full knowledge graph (nodes + edges). */
    graph(): Promise<GraphData | null>;
    /** Get outgoing + incoming links for a page. */
    links(slug: string): Promise<PageLinks | null>;
    /** Get pages that link to this one. */
    backlinks(slug: string): Promise<{
        slug: string;
        title: string;
        type: string;
        link_type: string;
    }[] | null>;
    /** Get timeline entries for a page. */
    timeline(slug: string): Promise<TimelineEntry[] | null>;
    /** List all pages with optional filters. */
    listPages(options?: {
        type?: string;
        writtenBy?: string;
        limit?: number;
        offset?: number;
    }): Promise<PageListItem[] | null>;
    /** Traverse the knowledge graph from a starting page. */
    traverse(slug: string, options?: {
        depth?: number;
        direction?: "out" | "in" | "both";
    }): Promise<TraversalResult[] | null>;
    /** Get version history for a page. */
    getVersions(slug: string): Promise<VersionEntry[] | null>;
    /** Get activity feed for the brain. */
    getActivity(options?: {
        limit?: number;
        action?: string;
    }): Promise<ActivityEntry[]>;
    /** Get stored raw data for a page. */
    getRawData(slug: string, source?: string): Promise<RawDataEntry[]>;
    /** Get tags for a page. */
    getTags(slug: string): Promise<TagsResult | null>;
    /** Create or update a page. */
    putPage(input: PutPageInput): Promise<PutPageResult | null>;
    /** Delete a page by slug. */
    deletePage(slug: string): Promise<{
        success: boolean;
        slug: string;
    } | null>;
    /** Create a typed link between two pages. */
    addLink(from: string, to: string, linkType?: string, writtenBy?: string): Promise<{
        success: boolean;
        from: string;
        to: string;
        link_type: string;
    } | null>;
    /** Remove a link between two pages. */
    removeLink(from: string, to: string): Promise<{
        success: boolean;
        from: string;
        to: string;
    } | null>;
    /** Add a timeline entry to a page. */
    addTimelineEntry(slug: string, date: string, summary: string, options?: {
        detail?: string;
        source?: string;
        written_by?: string;
    }): Promise<{
        id: string;
    } | null>;
    /** Add a tag to a page. */
    addTag(slug: string, tag: string): Promise<{
        tags: string[];
    }>;
    /** Remove a tag from a page. */
    removeTag(slug: string, tag: string): Promise<{
        tags: string[];
    }>;
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
    enrich(input: EnrichInput): Promise<EnrichResult | EnrichQueued>;
    /** Get job status by ID. */
    getJob(jobId: number): Promise<JobStatus | null>;
    /** List all jobs with optional status filter. */
    listJobs(options?: {
        status?: string;
        limit?: number;
    }): Promise<JobStatus[]>;
    /** Retry a failed job. */
    retryJob(jobId: number): Promise<{
        success: boolean;
    }>;
    /** Create a new API key. The full key is only returned once. */
    createApiKey(name: string): Promise<ApiKeyCreated>;
    /** List all API keys (masked). */
    listApiKeys(): Promise<ApiKeyResult[]>;
    /** Revoke an API key by ID. */
    revokeApiKey(keyId: string): Promise<{
        success: boolean;
    }>;
}
export declare class BrainbaseError extends Error {
    code: number;
    constructor(message: string, code: number);
}
//# sourceMappingURL=index.d.ts.map