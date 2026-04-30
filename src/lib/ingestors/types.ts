/**
 * Ingestor framework — generic interface for pulling data from company systems
 * into the Brainbase knowledge graph.
 *
 * Each ingestor is responsible for:
 * 1. Authentication with the source system
 * 2. Fetching raw documents since a given date
 * 3. Transforming into Brainbase pages (with links, timeline, attribution)
 * 4. Emitting provenance metadata (source system, confidence, raw ID)
 */

export interface RawDocument {
  /** Unique ID from the source system */
  id: string;
  /** Source system name */
  source: string;
  /** When this was created in the source */
  createdAt: Date;
  /** When this was last modified */
  updatedAt: Date;
  /** Raw content (markdown, text, JSON) */
  content: string;
  /** Structured metadata (author, channel, thread ID, etc) */
  metadata: Record<string, unknown>;
}

export interface BrainPageDraft {
  slug: string;
  title: string;
  type: string;
  content: string;
  frontmatter: Record<string, unknown>;
  links?: { to: string; type: string }[];
  timeline?: { date: string; summary: string; detail?: string }[];
  /** Which ingestor produced this */
  writtenBy: string;
  /** Source system + ID for provenance */
  provenance: { system: string; id: string; url?: string };
  /** Confidence score 0-1 based on source reliability */
  confidence: number;
}

export interface Ingestor {
  /** Unique name, e.g. "slack", "gmail", "linear" */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;

  /** Required config keys */
  readonly requiredConfig: string[];

  /** Authenticate with the source system */
  authenticate(config: Record<string, string>): Promise<void>;

  /** Fetch raw documents since `cursor` (date or pagination token) */
  fetch(cursor: string | null): Promise<{
    documents: RawDocument[];
    nextCursor: string | null;
    hasMore: boolean;
  }>;

  /** Transform raw documents into Brainbase page drafts */
  transform(doc: RawDocument): Promise<BrainPageDraft[]>;
}

export interface IngestorRegistry {
  [name: string]: new () => Ingestor;
}

export const INGESTORS: IngestorRegistry = {};

export function registerIngestor(name: string, ctor: new () => Ingestor) {
  INGESTORS[name] = ctor;
}

export function getIngestor(name: string): Ingestor | null {
  const Ctor = INGESTORS[name];
  return Ctor ? new Ctor() : null;
}
