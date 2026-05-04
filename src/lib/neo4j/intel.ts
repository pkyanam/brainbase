/**
 * Graph intelligence — PageRank, community detection, shortest-path, similarity.
 *
 * This is the moat. Postgres can't do these (or can only do them painfully).
 * Neo4j GDS (Graph Data Science) makes them one Cypher call.
 *
 * Availability tiers:
 *   - shortestPath:  always works (native Cypher).
 *   - degree:        always works (native Cypher) — used as PageRank fallback.
 *   - pagerank/louvain/similarity: requires the Neo4j GDS plugin.
 *
 * Each function returns either a result or { unavailable: true, reason }
 * so the caller can decide how to render. We never throw on "GDS missing".
 */

import { runQuery, runWrite, isSingleDbMode } from "./driver";

let _gdsAvailable: boolean | null = null;

/** Feature-detect GDS once per process. AuraDB has it; Community needs the plugin. */
export async function isGdsAvailable(): Promise<boolean> {
  if (_gdsAvailable !== null) return _gdsAvailable;
  try {
    const rows = await runQuery("neo4j", `RETURN gds.version() AS v`);
    _gdsAvailable = !!rows[0]?.v;
    console.log("[brainbase/neo4j] GDS detection:", { available: _gdsAvailable, result: rows[0] });
  } catch (err: any) {
    console.error("[brainbase/neo4j] GDS detection failed:", err?.message || String(err));
    _gdsAvailable = false;
  }
  return _gdsAvailable;
}

const NODE_QUERY_FRAGMENT = (single: boolean) =>
  single
    ? `MATCH (p:Page {brain_id: $brainId}) RETURN id(p) AS id`
    : `MATCH (p:Page) RETURN id(p) AS id`;

const REL_QUERY_FRAGMENT = (single: boolean) =>
  single
    ? `MATCH (a:Page {brain_id: $brainId})-[r:LINKS_TO]->(b:Page {brain_id: $brainId})
       RETURN id(a) AS source, id(b) AS target, 1.0 AS weight`
    : `MATCH (a:Page)-[r:LINKS_TO]->(b:Page) RETURN id(a) AS source, id(b) AS target, 1.0 AS weight`;

// ── PageRank ──────────────────────────────────────────────────

export interface PageRankResult {
  slug: string;
  title: string;
  type: string;
  score: number;
}

export interface PageRankResponse {
  available: boolean;
  algorithm: "pagerank-gds" | "degree-fallback";
  reason?: string;
  results: PageRankResult[];
}

export async function pageRank(brainId: string, limit = 25): Promise<PageRankResponse> {
  const single = isSingleDbMode();
  const gds = await isGdsAvailable();

  if (gds) {
    const graphName = single ? `brain_${brainId.replace(/-/g, '_')}` : 'brain_graph';

    try {
      // Drop graph if it exists
      await runWrite(
        brainId,
        `CALL gds.graph.drop($graphName, false)`,
        { graphName }
      ).catch(() => {});

      // Create named graph projection
      const nodeCypher = single
        ? `MATCH (p:Page {brain_id: $brainId}) RETURN id(p) AS id`
        : `MATCH (p:Page) RETURN id(p) AS id`;
      const relCypher = single
        ? `MATCH (p:Page {brain_id: $brainId})-[r:LINKS_TO]->(q:Page {brain_id: $brainId}) RETURN id(p) AS source, id(q) AS target, 1.0 AS weight`
        : `MATCH (p:Page)-[r:LINKS_TO]->(q:Page) RETURN id(p) AS source, id(q) AS target, 1.0 AS weight`;

      await runWrite(
        brainId,
        `CALL gds.graph.project.cypher(
          $graphName,
          $nodeCypher,
          $relCypher,
          { parameters: { brainId: $brainId } }
        )`,
        { graphName, nodeCypher, relCypher }
      );

      // Step 2: Run PageRank on the named graph
      const rows = await runQuery(
        brainId,
        `CALL gds.pageRank.stream($graphName, { relationshipWeightProperty: 'weight' })
         YIELD nodeId, score
         WITH gds.util.asNode(nodeId) AS n, score
         RETURN n.slug AS slug, n.title AS title, n.type AS type, score
         ORDER BY score DESC LIMIT toInteger($limit)`,
        { graphName, limit }
      );

      return {
        available: true,
        algorithm: "pagerank-gds",
        results: rows as PageRankResult[],
      };
    } catch (err: any) {
      console.error("[brainbase/neo4j] PageRank GDS failed:", err?.message);
      // Fall through to degree centrality
    }
  }

  // Fallback: degree centrality (incoming + outgoing). Not PageRank, but the
  // same shape and useful enough on small graphs to keep the dashboard alive.
  const rows = await runQuery(
    brainId,
    `MATCH (p:Page${single ? " {brain_id: $brainId}" : ""})
     OPTIONAL MATCH (p)-[r:LINKS_TO]-()
     WITH p, count(r) AS degree
     RETURN p.slug AS slug, p.title AS title, p.type AS type, toFloat(degree) AS score
     ORDER BY score DESC LIMIT toInteger($limit)`,
    { limit }
  );
  return {
    available: true,
    algorithm: "degree-fallback",
    reason: "Neo4j GDS plugin not detected — using degree centrality. Install GDS for true PageRank.",
    results: rows as PageRankResult[],
  };
}

// ── Communities (Louvain) ─────────────────────────────────────

export interface CommunityNode {
  slug: string;
  title: string;
  type: string;
  community_id: number;
}

export interface CommunitiesResponse {
  available: boolean;
  algorithm: "louvain-gds";
  reason?: string;
  community_count: number;
  results: CommunityNode[];
}

export async function communities(brainId: string, limit = 500): Promise<CommunitiesResponse> {
  const single = isSingleDbMode();
  const gds = await isGdsAvailable();
  if (!gds) {
    return {
      available: false,
      algorithm: "louvain-gds",
      reason: "Neo4j GDS plugin required for community detection. Install via NEO4J_PLUGINS=[\"graph-data-science\"].",
      community_count: 0,
      results: [],
    };
  }

  const graphName = single ? `brain_${brainId.replace(/-/g, '_')}` : 'brain_graph';

  try {
    // Drop graph if it exists (make this idempotent)
    await runWrite(
      brainId,
      `CALL gds.graph.drop($graphName, false)`,
      { graphName }
    ).catch(() => {
      // Ignore errors if graph doesn't exist
    });

    // Create named graph projection
    const nodeCypher = single
      ? `MATCH (p:Page {brain_id: $brainId}) RETURN id(p) AS id`
      : `MATCH (p:Page) RETURN id(p) AS id`;
    const relCypher = single
      ? `MATCH (p:Page {brain_id: $brainId})-[r:LINKS_TO]->(q:Page {brain_id: $brainId}) RETURN id(p) AS source, id(q) AS target, 1.0 AS weight`
      : `MATCH (p:Page)-[r:LINKS_TO]->(q:Page) RETURN id(p) AS source, id(q) AS target, 1.0 AS weight`;

    await runWrite(
      brainId,
      `CALL gds.graph.project.cypher(
        $graphName,
        $nodeCypher,
        $relCypher,
        { parameters: { brainId: $brainId } }
      )`,
      { graphName, nodeCypher, relCypher }
    );

    // Use stream mode for Louvain
    const rows = await runQuery(
      brainId,
      `CALL gds.louvain.stream($graphName)
       YIELD nodeId, communityId
       WITH gds.util.asNode(nodeId) AS n, communityId
       RETURN n.slug AS slug, n.title AS title, n.type AS type, communityId AS community_id
       ORDER BY communityId, n.slug
       LIMIT toInteger($limit)`,
      { graphName, limit }
    );

    const ids = new Set<number>();
    for (const r of rows) ids.add(Number(r.community_id));
    return {
      available: true,
      algorithm: "louvain-gds",
      community_count: ids.size,
      results: rows as CommunityNode[],
    };
  } catch (err: any) {
    console.error("[brainbase/neo4j] Louvain failed:", err?.message);
    return {
      available: false,
      algorithm: "louvain-gds",
      reason: err?.message || "Unknown error",
      community_count: 0,
      results: [],
    };
  }
}

// ── Shortest path ─────────────────────────────────────────────

export interface ShortestPathHop {
  slug: string;
  title: string;
  type: string;
  link_type?: string | null;
}

export interface ShortestPathResponse {
  available: boolean;
  found: boolean;
  length: number;
  hops: ShortestPathHop[];
  reason?: string;
}

export async function shortestPath(
  brainId: string,
  fromSlug: string,
  toSlug: string,
  maxDepth = 6
): Promise<ShortestPathResponse> {
  const single = isSingleDbMode();
  const cap = Math.min(Math.max(maxDepth, 1), 10);

  // Always available — pure Cypher, no plugin needed.
  const rows = await runQuery(
    brainId,
    `MATCH (a:Page${single ? " {brain_id: $brainId, slug: $fromSlug}" : " {slug: $fromSlug}"})
     MATCH (b:Page${single ? " {brain_id: $brainId, slug: $toSlug}" : " {slug: $toSlug}"})
     MATCH p = shortestPath((a)-[:LINKS_TO*1..${cap}]-(b))
     WITH p,
          [n IN nodes(p) | { slug: n.slug, title: n.title, type: n.type }] AS hops,
          [r IN relationships(p) | r.type] AS link_types
     RETURN hops, link_types, length(p) AS len`,
    { fromSlug, toSlug }
  );
  if (rows.length === 0) {
    return { available: true, found: false, length: 0, hops: [] };
  }
  const row = rows[0];
  const hops = (row.hops as ShortestPathHop[]).map((h, i) => ({
    ...h,
    link_type: i > 0 ? (row.link_types?.[i - 1] ?? null) : null,
  }));
  return {
    available: true,
    found: true,
    length: Number(row.len ?? hops.length - 1),
    hops,
  };
}

// ── Node similarity ───────────────────────────────────────────

export interface SimilarityHit {
  slug: string;
  title: string;
  type: string;
  similarity: number;
}

export interface SimilarityResponse {
  available: boolean;
  algorithm: "node-similarity-gds" | "jaccard-fallback";
  reason?: string;
  results: SimilarityHit[];
}

export async function similarPages(
  brainId: string,
  slug: string,
  limit = 10
): Promise<SimilarityResponse> {
  const single = isSingleDbMode();
  const gds = await isGdsAvailable();

  if (gds) {
    const graphName = single ? `brain_${brainId.replace(/-/g, '_')}` : 'brain_graph';

    try {
      // Drop graph if it exists
      await runWrite(
        brainId,
        `CALL gds.graph.drop($graphName, false)`,
        { graphName }
      ).catch(() => {});

      // Create named graph projection
      const nodeCypher = single
        ? `MATCH (p:Page {brain_id: $brainId}) RETURN id(p) AS id`
        : `MATCH (p:Page) RETURN id(p) AS id`;
      const relCypher = single
        ? `MATCH (p:Page {brain_id: $brainId})-[r:LINKS_TO]->(q:Page {brain_id: $brainId}) RETURN id(p) AS source, id(q) AS target, 1.0 AS weight`
        : `MATCH (p:Page)-[r:LINKS_TO]->(q:Page) RETURN id(p) AS source, id(q) AS target, 1.0 AS weight`;

      await runWrite(
        brainId,
        `CALL gds.graph.project.cypher(
          $graphName,
          $nodeCypher,
          $relCypher,
          { parameters: { brainId: $brainId } }
        )`,
        { graphName, nodeCypher, relCypher }
      );

      const rows = await runQuery(
        brainId,
        `CALL gds.nodeSimilarity.stream($graphName)
         YIELD node1, node2, similarity
         WITH gds.util.asNode(node1) AS a, gds.util.asNode(node2) AS b, similarity
         WHERE a.slug = $slug
         RETURN b.slug AS slug, b.title AS title, b.type AS type, similarity
         ORDER BY similarity DESC LIMIT toInteger($limit)`,
        { graphName, slug, limit }
      );

      return {
        available: true,
        algorithm: "node-similarity-gds",
        results: rows as SimilarityHit[],
      };
    } catch (err: any) {
      console.error("[brainbase/neo4j] nodeSimilarity failed:", err?.message);
      // Fall through to Jaccard
    }
  }

  // Fallback: Jaccard on the neighbor sets — pure Cypher.
  const rows = await runQuery(
    brainId,
    `MATCH (a:Page${single ? " {brain_id: $brainId, slug: $slug}" : " {slug: $slug}"})-[:LINKS_TO]-(neighbor)
     WITH a, collect(DISTINCT neighbor) AS aNeighbors
     UNWIND aNeighbors AS n
     MATCH (n)-[:LINKS_TO]-(b:Page${single ? " {brain_id: $brainId}" : ""})
     WHERE b <> a
     WITH a, b, aNeighbors, collect(DISTINCT n) AS shared
     MATCH (b)-[:LINKS_TO]-(bNeighbor)
     WITH a, b, aNeighbors, shared, collect(DISTINCT bNeighbor) AS bNeighbors
     WITH b,
          toFloat(size(shared)) /
          (toFloat(size(aNeighbors) + size(bNeighbors) - size(shared))) AS similarity
     WHERE similarity > 0
     RETURN b.slug AS slug, b.title AS title, b.type AS type, similarity
     ORDER BY similarity DESC LIMIT toInteger($limit)`,
    { slug, limit }
  );
  return {
    available: true,
    algorithm: "jaccard-fallback",
    reason: "Neo4j GDS plugin not detected — using Jaccard similarity on link neighborhoods.",
    results: rows as SimilarityHit[],
  };
}
