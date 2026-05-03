/**
 * Neo4j-backed graph engine for Brainbase.
 *
 * Ported from GraphBrain's engine into the Brainbase tree. This module is the
 * derived graph projection — Postgres holds page content, embeddings, jobs,
 * billing; Neo4j holds the slug/type/edge skeleton that powers fast traversal
 * and graph algorithms (PageRank, Louvain, shortest-path, similarity).
 *
 * The dream cycle's graph-sync phase keeps this in step with Postgres.
 */

import {
  runQuery,
  runWrite,
  createDatabase,
  initializeBrain,
  dropDatabase,
  isSingleDbMode,
} from "./driver";

// ── Types (kept identical to the original GraphBrain shape so any
//    existing GBrainEngine adapter clients keep working). ──

export interface Page {
  slug: string;
  title: string;
  type: string;
  content: string;
  frontmatter: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PageInput {
  slug: string;
  title: string;
  type?: string;
  content?: string;
  frontmatter?: Record<string, unknown>;
}

export interface Link {
  from_slug: string;
  to_slug: string;
  link_type: string;
  context: string;
  created_at: string;
}

export interface LinkInput {
  from_slug: string;
  to_slug: string;
  link_type?: string;
  context?: string;
}

export interface LinkBatchInput {
  from_slug: string;
  to_slug: string;
  link_type?: string;
  context?: string;
  link_source?: string;
}

export interface TraversalResult {
  slug: string;
  title: string;
  type: string;
  depth: number;
  link_type?: string;
}

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

export interface TimelineEntry {
  date: string;
  summary: string;
  detail: string;
  source: string;
}

export interface TimelineInput {
  slug: string;
  date: string;
  summary: string;
  detail?: string;
  source?: string;
}

export interface BrainStats {
  page_count: number;
  link_count: number;
  brain_score: number;
  pages_by_type: Record<string, number>;
  most_connected: { slug: string; title: string; link_count: number }[];
}

// ── Page operations ──

export async function putPage(brainId: string, input: PageInput): Promise<Page> {
  const now = new Date().toISOString();
  const single = isSingleDbMode();
  const result = await runWrite(
    brainId,
    `MERGE (p:Page {slug: $slug})
     ON CREATE SET p.title = $title, p.type = $type, p.content = $content,
                   p.frontmatter = $frontmatter, p.created_at = $createdAt, p.updated_at = $updatedAt
                   ${single ? ", p.brain_id = $brainId" : ""}
     ON MATCH SET p.title = $title, p.type = $type, p.content = $content,
                  p.frontmatter = $frontmatter, p.updated_at = $updatedAt
     RETURN p.slug AS slug, p.title AS title, p.type AS type,
            p.content AS content, p.frontmatter AS frontmatter,
            p.created_at AS created_at, p.updated_at AS updated_at`,
    {
      slug: input.slug,
      title: input.title,
      type: input.type || "unknown",
      content: input.content || "",
      frontmatter: JSON.stringify(input.frontmatter || {}),
      createdAt: now,
      updatedAt: now,
    }
  );

  const row = result[0];
  return {
    slug: row.slug,
    title: row.title,
    type: row.type,
    content: row.content,
    frontmatter:
      typeof row.frontmatter === "string"
        ? JSON.parse(row.frontmatter)
        : row.frontmatter,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getPage(brainId: string, slug: string): Promise<Page | null> {
  const result = await runQuery(
    brainId,
    `MATCH (p:Page {slug: $slug})
     RETURN p.slug AS slug, p.title AS title, p.type AS type,
            p.content AS content, p.frontmatter AS frontmatter,
            p.created_at AS created_at, p.updated_at AS updated_at`,
    { slug }
  );
  if (result.length === 0) return null;
  const row = result[0];
  return {
    slug: row.slug,
    title: row.title,
    type: row.type,
    content: row.content,
    frontmatter:
      typeof row.frontmatter === "string"
        ? JSON.parse(row.frontmatter)
        : row.frontmatter,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function deletePage(brainId: string, slug: string): Promise<boolean> {
  const result = await runWrite(
    brainId,
    `MATCH (p:Page {slug: $slug}) DETACH DELETE p RETURN count(p) AS deleted`,
    { slug }
  );
  return result[0]?.deleted > 0;
}

export async function renamePage(
  brainId: string,
  oldSlug: string,
  newSlug: string
): Promise<Page> {
  const result = await runWrite(
    brainId,
    `MATCH (p:Page {slug: $oldSlug})
     SET p.slug = $newSlug, p.updated_at = $now
     RETURN p.slug AS slug, p.title AS title, p.type AS type,
            p.content AS content, p.frontmatter AS frontmatter,
            p.created_at AS created_at, p.updated_at AS updated_at`,
    { oldSlug, newSlug, now: new Date().toISOString() }
  );
  if (result.length === 0) throw new Error(`Page '${oldSlug}' not found`);
  const row = result[0];
  return {
    slug: row.slug,
    title: row.title,
    type: row.type,
    content: row.content,
    frontmatter:
      typeof row.frontmatter === "string"
        ? JSON.parse(row.frontmatter)
        : row.frontmatter,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listPages(
  brainId: string,
  opts?: { type?: string; limit?: number; offset?: number }
): Promise<{ slug: string; title: string; type: string; updated_at: string }[]> {
  let cypher = `MATCH (p:Page)`;
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (opts?.type) {
    conditions.push(`p.type = $type`);
    params.type = opts.type;
  }
  if (conditions.length > 0) {
    cypher += ` WHERE ` + conditions.join(" AND ");
  }
  cypher += ` RETURN p.slug AS slug, p.title AS title, p.type AS type, p.updated_at AS updated_at
              ORDER BY p.updated_at DESC
              SKIP $offset LIMIT $limit`;
  params.offset = opts?.offset ?? 0;
  params.limit = opts?.limit ?? 50;

  return (await runQuery(brainId, cypher, params)) as {
    slug: string;
    title: string;
    type: string;
    updated_at: string;
  }[];
}

// ── Link operations ──

export async function addLink(brainId: string, input: LinkInput): Promise<boolean> {
  const single = isSingleDbMode();
  const result = await runWrite(
    brainId,
    `MATCH (from:Page {slug: $fromSlug}), (to:Page {slug: $toSlug})
     MERGE (from)-[r:LINKS_TO {type: $linkType}]->(to)
     ON CREATE SET r.context = $context, r.created_at = $now${single ? ", r.brain_id = $brainId" : ""}
     ON MATCH SET r.context = $context
     RETURN r`,
    {
      fromSlug: input.from_slug,
      toSlug: input.to_slug,
      linkType: input.link_type || "related",
      context: input.context || "",
      now: new Date().toISOString(),
    }
  );
  return result.length > 0;
}

export async function addLinksBatch(
  brainId: string,
  links: LinkBatchInput[]
): Promise<{ succeeded: number; failed: number }> {
  const now = new Date().toISOString();
  const single = isSingleDbMode();
  const result = await runWrite(
    brainId,
    `UNWIND $links AS link
     MATCH (from:Page {slug: link.from_slug}), (to:Page {slug: link.to_slug})
     MERGE (from)-[r:LINKS_TO {type: link.link_type}]->(to)
     ON CREATE SET r.context = link.context, r.created_at = $now, r.link_source = link.link_source${single ? ", r.brain_id = $brainId" : ""}
     RETURN count(r) AS created`,
    {
      links: links.map((l) => ({
        from_slug: l.from_slug,
        to_slug: l.to_slug,
        link_type: l.link_type || "related",
        context: l.context || "",
        link_source: l.link_source || "manual",
      })),
      now,
    }
  );
  const created = result[0]?.created || 0;
  return { succeeded: created, failed: links.length - created };
}

export async function removeLink(
  brainId: string,
  fromSlug: string,
  toSlug: string,
  linkType?: string
): Promise<boolean> {
  let cypher: string;
  const params: Record<string, unknown> = { fromSlug, toSlug };

  if (linkType) {
    cypher = `MATCH (from:Page {slug: $fromSlug})-[r:LINKS_TO {type: $linkType}]->(to:Page {slug: $toSlug}) DELETE r RETURN count(r) AS deleted`;
    params.linkType = linkType;
  } else {
    cypher = `MATCH (from:Page {slug: $fromSlug})-[r:LINKS_TO]->(to:Page {slug: $toSlug}) DELETE r RETURN count(r) AS deleted`;
  }

  const result = await runWrite(brainId, cypher, params);
  return result[0]?.deleted > 0;
}

export async function getLinks(brainId: string, slug: string): Promise<Link[]> {
  return (await runQuery(
    brainId,
    `MATCH (from:Page {slug: $slug})-[r:LINKS_TO]->(to:Page)
     RETURN from.slug AS from_slug, to.slug AS to_slug,
            r.type AS link_type, r.context AS context,
            toString(r.created_at) AS created_at`,
    { slug }
  )) as Link[];
}

export async function getBacklinks(brainId: string, slug: string): Promise<Link[]> {
  return (await runQuery(
    brainId,
    `MATCH (from:Page)-[r:LINKS_TO]->(to:Page {slug: $slug})
     RETURN from.slug AS from_slug, to.slug AS to_slug,
            r.type AS link_type, r.context AS context,
            toString(r.created_at) AS created_at`,
    { slug }
  )) as Link[];
}

// ── Graph traversal — native Neo4j BFS ──

const TYPE_COLOR_MAP: Record<string, number> = {
  person: 0,
  company: 1,
  project: 2,
  concept: 3,
  idea: 4,
  place: 5,
  software: 6,
  "blog-post": 7,
  "pitch-deck": 8,
  meeting: 9,
  original: 10,
  "creative-work": 11,
};

export async function traverseGraph(
  brainId: string,
  startSlug: string,
  depth: number = 2,
  direction: "out" | "in" | "both" = "out",
  linkType?: string
): Promise<TraversalResult[]> {
  const depthCap = Math.min(depth, 10);

  const cypher = `
    MATCH path = (start:Page {slug: $startSlug})${direction === "in" ? "<" : ""}-[r:LINKS_TO*1..${depthCap}]-${direction === "out" ? ">" : ""}(node:Page)
    UNWIND relationships(path) AS rel
    WITH DISTINCT node, rel, length(path) AS pathLength
    ${linkType ? `WHERE rel.type = $linkType` : ""}
    RETURN node.slug AS slug, node.title AS title, node.type AS type,
           pathLength AS depth, rel.type AS link_type
    UNION
    MATCH (start:Page {slug: $startSlug})
    RETURN start.slug AS slug, start.title AS title, start.type AS type,
           0 AS depth, null AS link_type
    ORDER BY depth, title
  `;

  const params: Record<string, unknown> = { startSlug };
  if (linkType) params.linkType = linkType;

  const rows = await runQuery(brainId, cypher, params);

  const seen = new Set<string>();
  const results: TraversalResult[] = [];
  for (const row of rows) {
    const key = `${row.slug}|${row.depth}|${row.link_type || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        slug: row.slug,
        title: row.title,
        type: row.type,
        depth: row.depth,
        link_type: row.link_type || undefined,
      });
    }
  }
  return results;
}

export async function getGraphData(brainId: string): Promise<GraphData> {
  const nodes = await runQuery(
    brainId,
    `MATCH (p:Page)
     OPTIONAL MATCH (p)-[r:LINKS_TO]-()
     RETURN p.slug AS slug, p.title AS title, p.type AS type,
            count(r) AS linkCount
     ORDER BY linkCount DESC`
  );

  const edges = await runQuery(
    brainId,
    `MATCH (from:Page)-[r:LINKS_TO]->(to:Page)
     RETURN from.slug AS source, to.slug AS target, r.type AS type`
  );

  const nodeIds = new Set(nodes.map((n: any) => n.slug));

  return {
    nodes: nodes.map((n: any) => ({
      id: n.slug,
      label: n.title || n.slug.split("/").pop() || n.slug,
      type: n.type || "unknown",
      linkCount: n.linkCount || 0,
      group: TYPE_COLOR_MAP[n.type as string] ?? 9,
    })),
    edges: edges
      .filter((e: any) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e: any) => ({
        source: e.source,
        target: e.target,
        type: e.type || "related",
      })),
  };
}

export async function findOrphans(brainId: string): Promise<string[]> {
  const rows = await runQuery(
    brainId,
    `MATCH (p:Page)
     WHERE NOT (p)<-[:LINKS_TO]-()
     RETURN p.slug AS slug
     ORDER BY p.slug`
  );
  return rows.map((r: any) => r.slug);
}

// ── Timeline operations ──

export async function addTimelineEntry(
  brainId: string,
  input: TimelineInput
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const single = isSingleDbMode();
  await runWrite(
    brainId,
    `MATCH (p:Page {slug: $slug})
     CREATE (t:TimelineEntry {
       id: $id, date: date($date), summary: $summary,
       detail: $detail, source: $source, created_at: $now${single ? ", brain_id: $brainId" : ""}
     })
     CREATE (p)-[:HAS_TIMELINE]->(t)
     RETURN t.id AS id`,
    {
      slug: input.slug,
      id,
      date: input.date,
      summary: input.summary,
      detail: input.detail || "",
      source: input.source || "",
      now: new Date().toISOString(),
    }
  );
  return { id };
}

export async function addTimelineEntriesBatch(
  brainId: string,
  entries: TimelineInput[]
): Promise<{ succeeded: number; failed: number }> {
  const now = new Date().toISOString();
  const single = isSingleDbMode();
  const batchEntries = entries.map((e) => ({
    slug: e.slug,
    id: crypto.randomUUID(),
    date: e.date,
    summary: e.summary,
    detail: e.detail || "",
    source: e.source || "",
  }));

  const result = await runWrite(
    brainId,
    `UNWIND $entries AS entry
     MATCH (p:Page {slug: entry.slug})
     MERGE (t:TimelineEntry {id: entry.id})
     ON CREATE SET t.date = date(entry.date), t.summary = entry.summary,
                    t.detail = entry.detail, t.source = entry.source,
                    t.created_at = $now${single ? ", t.brain_id = $brainId" : ""}
     MERGE (p)-[:HAS_TIMELINE]->(t)
     RETURN count(t) AS created`,
    { entries: batchEntries, now }
  );

  const created = result[0]?.created || 0;
  return { succeeded: created, failed: entries.length - created };
}

export async function getTimeline(
  brainId: string,
  slug: string,
  opts?: { limit?: number; offset?: number }
): Promise<TimelineEntry[]> {
  return (await runQuery(
    brainId,
    `MATCH (p:Page {slug: $slug})-[:HAS_TIMELINE]->(t:TimelineEntry)
     RETURN toString(t.date) AS date, t.summary AS summary,
            t.detail AS detail, t.source AS source
     ORDER BY t.date DESC
     SKIP $offset LIMIT $limit`,
    {
      slug,
      offset: opts?.offset ?? 0,
      limit: opts?.limit ?? 50,
    }
  )) as TimelineEntry[];
}

// ── Stats ──

export async function getStats(brainId: string): Promise<BrainStats> {
  const pageCount = await runQuery(brainId, `MATCH (p:Page) RETURN count(p) AS count`);
  const linkCount = await runQuery(brainId, `MATCH ()-[r:LINKS_TO]->() RETURN count(r) AS count`);
  const typeBreakdown = await runQuery(
    brainId,
    `MATCH (p:Page) RETURN p.type AS type, count(p) AS count ORDER BY count DESC`
  );
  const mostConnected = await runQuery(
    brainId,
    `MATCH (p:Page)
     OPTIONAL MATCH (p)-[r:LINKS_TO]-()
     RETURN p.slug AS slug, p.title AS title, count(r) AS link_count
     ORDER BY link_count DESC LIMIT 5`
  );

  const pagesByType: Record<string, number> = {};
  for (const row of typeBreakdown) {
    pagesByType[row.type] = row.count;
  }

  const pc = Number(pageCount[0]?.count ?? 0);
  const lc = Number(linkCount[0]?.count ?? 0);
  const linkDensity = pc > 0 ? lc / pc : 0;
  const brainScore = Math.min(
    100,
    Math.round(Math.min(linkDensity * 100, 40) * 0.5 + (pc > 100 ? 50 : (pc / 100) * 50))
  );

  return {
    page_count: pc,
    link_count: lc,
    brain_score: brainScore,
    pages_by_type: pagesByType,
    most_connected: mostConnected.map((r: any) => ({
      slug: r.slug,
      title: r.title,
      link_count: r.link_count,
    })),
  };
}

// ── Brain provisioning (creates the per-brain database / index set) ──

export async function provisionBrain(brainId: string): Promise<void> {
  await createDatabase(brainId);
  await initializeBrain(brainId);
}

export async function deprovisionBrain(brainId: string): Promise<void> {
  await dropDatabase(brainId);
}

// ── Search via Neo4j fulltext (intentionally lightweight — Brainbase's
//    primary search is the Postgres hybrid pipeline. This exists for
//    parity with the GBrain engine adapter contract.) ──

export async function searchPages(
  brainId: string,
  query: string,
  limit: number = 20
): Promise<Page[]> {
  try {
    await runWrite(
      brainId,
      `CREATE FULLTEXT INDEX pageContent IF NOT EXISTS FOR (p:Page) ON EACH [p.title, p.content]`
    );
  } catch (e: any) {
    if (!String(e?.message ?? "").includes("already exists")) {
      console.error("[brainbase/neo4j] index creation error:", e.message);
    }
  }

  const result = await runQuery(
    brainId,
    `CALL db.index.fulltext.queryNodes('pageContent', $query)
     YIELD node, score
     RETURN node.slug AS slug, node.title AS title, node.type AS type,
            node.content AS content, node.frontmatter AS frontmatter,
            node.created_at AS created_at, node.updated_at AS updated_at,
            score
     ORDER BY score DESC LIMIT toInteger($limit)`,
    { query, limit }
  );

  return result.map((row: any) => ({
    slug: row.slug,
    title: row.title,
    type: row.type,
    content: row.content,
    frontmatter:
      typeof row.frontmatter === "string"
        ? JSON.parse(row.frontmatter)
        : row.frontmatter,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
