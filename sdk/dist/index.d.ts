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
    timeline?: {
        date: string;
        summary: string;
        detail?: string;
        source?: string;
    }[];
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
export declare class Brainbase {
    private apiKey;
    private baseUrl;
    private timeoutMs;
    constructor(config: BrainbaseConfig);
    private request;
    /** Search your brain by keyword or natural language. */
    search(query: string): Promise<SearchResult[]>;
    /** Ask a natural language question. */
    query(question: string): Promise<SearchResult[]>;
    /** Get a specific page by slug. */
    getPage(slug: string): Promise<PageDetail | null>;
    /** Get brain statistics. */
    health(): Promise<BrainHealth | null>;
    /** Get detailed brain statistics (alias for health). */
    stats(): Promise<BrainHealth | null>;
    /** Get full knowledge graph data. */
    graph(): Promise<GraphData | null>;
    /** Get links for a page. */
    links(slug: string): Promise<PageLinks | null>;
    /** Get backlinks (pages that link to this one). */
    backlinks(slug: string): Promise<{
        slug: string;
        title: string;
        type: string;
        link_type: string;
    }[] | null>;
    /** Get timeline entries for a page. */
    timeline(slug: string): Promise<TimelineEntry[] | null>;
    /** List all pages with optional type filter. */
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
}
export declare class BrainbaseError extends Error {
    code: number;
    constructor(message: string, code: number);
}
//# sourceMappingURL=index.d.ts.map