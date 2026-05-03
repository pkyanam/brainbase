/**
 * Brainbase Neo4j subsystem — barrel export.
 *
 * Postgres remains the system of record. Neo4j is a derived graph projection
 * kept in sync by the dream cycle's graph-sync phase. Use this module from:
 *   - graph traversal endpoints (BFS up to 10 hops)
 *   - graph-intelligence endpoints (PageRank, Louvain, similarity, shortest-path)
 *   - the graph-sync dream phase
 *
 * Do NOT use it for content reads, search, embeddings, billing, auth, or jobs —
 * those stay in Postgres.
 */

export * from "./engine";
export {
  runQuery,
  runWrite,
  isSingleDbMode,
  ping,
  close,
  createDatabase,
  dropDatabase,
  initializeBrain,
} from "./driver";
export { syncBrainGraph, ensureSyncSchema } from "./sync";
export type { SyncResult, SyncOptions } from "./sync";
export {
  pageRank,
  communities,
  shortestPath,
  similarPages,
  isGdsAvailable,
} from "./intel";
export type {
  PageRankResponse,
  CommunitiesResponse,
  ShortestPathResponse,
  SimilarityResponse,
} from "./intel";
