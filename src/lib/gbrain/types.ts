// Brain engine types
export type PageType = "person" | "company" | "project" | "concept" | "idea" | "source" | "meeting";

export interface BrainPage {
  slug: string;
  title: string;
  type: PageType;
  content: string;
  frontmatter: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BrainLink {
  from_slug: string;
  to_slug: string;
  link_type: string;
}

export interface BrainStats {
  page_count: number;
  pages_by_type: Record<string, number>;
  link_count: number;
  brain_score: number;
}

export interface SearchResult {
  slug: string;
  title: string;
  type: PageType;
  score: number;
  excerpt: string;
}
