/**
 * Graph-backend router. Brainbase serves graph reads (traversal, full graph)
 * from either Postgres (recursive CTEs) or Neo4j (native BFS), depending on
 * configuration and runtime health.
 *
 * Selection rules:
 *   1. `BRAINBASE_GRAPH_BACKEND=postgres` → always Postgres (escape hatch).
 *   2. `BRAINBASE_GRAPH_BACKEND=neo4j` → Neo4j only, no fallback. Errors surface.
 *   3. Default ("auto"): try Neo4j first (when `NEO4J_URI` is set), fall back to
 *      Postgres on any error or when the projection has never run for this brain.
 *
 * Postgres remains the system of record. Neo4j is a derived projection — the
 * fallback exists so a Neo4j outage never takes down the dashboard.
 */

import * as pg from "./supabase/write";
import * as pgGraph from "./supabase/graph";
import type { GraphData } from "./supabase/graph";

interface TraversalResult {
  slug: string;
  title: string;
  type: string;
  depth: number;
  link_type?: string;
}

type Backend = "postgres" | "neo4j";

function configuredBackend(): "postgres" | "neo4j" | "auto" {
  const v = (process.env.BRAINBASE_GRAPH_BACKEND || "auto").toLowerCase();
  if (v === "postgres" || v === "neo4j") return v;
  return "auto";
}

function neo4jAvailable(): boolean {
  return !!process.env.NEO4J_URI;
}

/** Returns the backend that *should* serve this read. Useful for /api/health. */
export function preferredBackend(): Backend {
  const cfg = configuredBackend();
  if (cfg === "postgres") return "postgres";
  if (cfg === "neo4j") return "neo4j";
  return neo4jAvailable() ? "neo4j" : "postgres";
}

export interface GraphReadResult<T> {
  data: T;
  backend: Backend;
  fellBack: boolean;
}

export async function traverseGraph(
  brainId: string,
  startSlug: string,
  depth = 2,
  direction: "out" | "in" | "both" = "out",
  linkType?: string
): Promise<GraphReadResult<TraversalResult[]>> {
  const cfg = configuredBackend();

  if (cfg !== "postgres" && neo4jAvailable()) {
    try {
      const neo = await import("./neo4j/engine");
      const data = await neo.traverseGraph(brainId, startSlug, depth, direction, linkType);
      return { data, backend: "neo4j", fellBack: false };
    } catch (e: any) {
      if (cfg === "neo4j") throw e; // strict mode — don't fall back
      console.warn("[brainbase/graph-router] traverse: Neo4j failed, falling back to Postgres:", e?.message);
    }
  }

  const data = await pg.traverseGraph(brainId, startSlug, depth, direction, linkType);
  return { data, backend: "postgres", fellBack: cfg !== "postgres" && neo4jAvailable() };
}

export async function getGraphData(brainId: string): Promise<GraphReadResult<GraphData>> {
  const cfg = configuredBackend();

  if (cfg !== "postgres" && neo4jAvailable()) {
    try {
      const neo = await import("./neo4j/engine");
      const data = await neo.getGraphData(brainId);
      // If Neo4j says the projection is empty for this brain, fall back to
      // Postgres rather than serve an empty graph — likely the sync hasn't
      // run yet for this brain.
      if (data.nodes.length === 0 && cfg !== "neo4j") {
        const pgData = await pgGraph.getGraphData(brainId);
        if (pgData.nodes.length > 0) {
          return { data: pgData, backend: "postgres", fellBack: true };
        }
      }
      return { data, backend: "neo4j", fellBack: false };
    } catch (e: any) {
      if (cfg === "neo4j") throw e;
      console.warn("[brainbase/graph-router] getGraphData: Neo4j failed, falling back to Postgres:", e?.message);
    }
  }

  const data = await pgGraph.getGraphData(brainId);
  return { data, backend: "postgres", fellBack: cfg !== "postgres" && neo4jAvailable() };
}
