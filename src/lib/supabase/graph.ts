import { queryMany } from "./client";

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  linkCount: number;
  group: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export async function getGraphData(brainId: string): Promise<GraphData> {
  const pageRows = await queryMany<{
    slug: string; title: string; type: string; link_count: string;
  }>(
    `SELECT p.slug, p.title, p.type,
            COUNT(l.id)::text as link_count
     FROM pages p
     LEFT JOIN links l ON l.brain_id = $1 AND (l.from_page_id = p.id OR l.to_page_id = p.id)
     WHERE p.brain_id = $1
     GROUP BY p.id, p.slug, p.title, p.type`,
    [brainId]
  );

  const linkRows = await queryMany<{
    from_slug: string; to_slug: string; link_type: string;
  }>(
    `SELECT fp.slug as from_slug, tp.slug as to_slug, l.link_type
     FROM links l
     JOIN pages fp ON fp.id = l.from_page_id
     JOIN pages tp ON tp.id = l.to_page_id
     WHERE l.brain_id = $1`,
    [brainId]
  );

  const typeColorMap: Record<string, number> = {
    person: 0,
    company: 1,
    project: 2,
    concept: 3,
    idea: 4,
    place: 5,
    software: 6,
    "blog-post": 7,
    "pitch-deck": 8,
    "project-prd": 8,
    meeting: 9,
    original: 10,
    "creative-work": 11,
  };

  const nodes = pageRows.map(p => ({
    id: p.slug,
    label: p.title || p.slug.split("/").pop() || p.slug,
    type: p.type || "unknown",
    linkCount: parseInt(p.link_count) || 0,
    group: typeColorMap[p.type] ?? 9,
  }));

  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = linkRows
    .filter(l => nodeIds.has(l.from_slug) && nodeIds.has(l.to_slug))
    .map(l => ({
      source: l.from_slug,
      target: l.to_slug,
      type: l.link_type || "related",
    }));

  return { nodes, edges };
}
