/**
 * Neo4j driver wrapper for Brainbase — manages the connection pool
 * and routes queries to the right database.
 *
 * Two operating modes:
 *   1. Multi-DB (default): each brain → its own Neo4j database. Requires
 *      Neo4j Enterprise or self-hosted Community with multi-DB enabled.
 *   2. Single-DB (NEO4J_SINGLE_DB=true): all brains share one database,
 *      isolated by a `brain_id` property on every node/edge. Works on
 *      AuraDB free tier and is the recommended deployment for v1.
 *
 * Postgres remains the system of record. Neo4j is a derived projection
 * kept in sync by the dream cycle's graph-sync phase.
 */

const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "brainbase-dev";
const SINGLE_DB_MODE = process.env.NEO4J_SINGLE_DB !== "false"; // default ON

let driverPromise: Promise<unknown> | null = null;
let _driver: any = null;

async function getDriver(): Promise<any> {
  if (_driver) return _driver;
  if (!driverPromise) {
    driverPromise = import("neo4j-driver").then((neo4j) => {
      _driver = neo4j.default.driver(
        NEO4J_URI,
        neo4j.default.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
        { maxConnectionPoolSize: 50 }
      );
      return _driver;
    });
  }
  return driverPromise as Promise<any>;
}

export function isSingleDbMode(): boolean {
  return SINGLE_DB_MODE;
}

function dbName(brainId: string): string {
  return SINGLE_DB_MODE ? "neo4j" : brainId;
}

function withBrain(brainId: string, params: Record<string, unknown>): Record<string, unknown> {
  return SINGLE_DB_MODE ? { ...params, brainId } : params;
}

export async function runQuery(
  brainId: string,
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<Record<string, any>[]> {
  const driver = await getDriver();
  const session = driver.session({ database: dbName(brainId) });
  try {
    const neo4j = await import("neo4j-driver");
    const safeParams: Record<string, any> = {};
    for (const [k, v] of Object.entries(params)) {
      // Neo4j rejects float params in LIMIT/SKIP — convert non-negative ints to neo4j.Integer.
      safeParams[k] =
        typeof v === "number" && Number.isInteger(v) && v >= 0
          ? neo4j.default.int(v)
          : v;
    }
    const result = await session.run(cypher, withBrain(brainId, safeParams));
    return result.records.map((r: any) => {
      const obj: Record<string, any> = {};
      r.keys.forEach((key: string) => {
        const val = r.get(key);
        // Convert Neo4j Integer (low/high pair) to plain Number for JSON.
        if (
          val !== null &&
          val !== undefined &&
          typeof val === "object" &&
          "low" in val &&
          "high" in val
        ) {
          obj[key] = Number(val);
        } else {
          obj[key] = val;
        }
      });
      return obj;
    });
  } finally {
    await session.close();
  }
}

export async function runWrite(
  brainId: string,
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<Record<string, any>[]> {
  return runQuery(brainId, cypher, params);
}

/** Create a Neo4j database for a brain (multi-DB mode only). */
export async function createDatabase(brainId: string): Promise<void> {
  if (SINGLE_DB_MODE) return;
  const driver = await getDriver();
  const session = driver.session({ database: "system" });
  try {
    await session.run(`CREATE DATABASE $name IF NOT EXISTS`, { name: brainId });
    await new Promise((r) => setTimeout(r, 500));
  } finally {
    await session.close();
  }
}

/** Drop a Neo4j database (multi-DB) or wipe brain-scoped nodes (single-DB). */
export async function dropDatabase(brainId: string): Promise<void> {
  if (SINGLE_DB_MODE) {
    await runWrite(
      brainId,
      `MATCH (n {brain_id: $brainId}) DETACH DELETE n`,
      { brainId }
    );
    return;
  }
  const driver = await getDriver();
  const session = driver.session({ database: "system" });
  try {
    await session.run(`DROP DATABASE $name IF EXISTS`, { name: brainId });
  } finally {
    await session.close();
  }
}

/** Initialize per-brain constraints and indexes. Safe to call repeatedly. */
export async function initializeBrain(brainId: string): Promise<void> {
  if (SINGLE_DB_MODE) {
    // Composite uniqueness via NODE KEY is Enterprise-only — fall back to
    // indexes + application-level MERGE for Community.
    const indexes = [
      `CREATE INDEX page_brain_slug IF NOT EXISTS FOR (p:Page) ON (p.brain_id, p.slug)`,
      `CREATE INDEX page_type IF NOT EXISTS FOR (p:Page) ON (p.type)`,
      `CREATE INDEX link_brain_type IF NOT EXISTS FOR ()-[r:LINKS_TO]-() ON (r.brain_id, r.type)`,
    ];
    for (const cypher of indexes) {
      try {
        await runWrite(brainId, cypher);
      } catch (e: any) {
        if (!String(e?.message ?? "").includes("already exists")) {
          console.error(`[brainbase/neo4j] index error:`, e.message);
        }
      }
    }
    return;
  }

  const constraints = [
    `CREATE CONSTRAINT page_slug IF NOT EXISTS FOR (p:Page) REQUIRE p.slug IS UNIQUE`,
    `CREATE INDEX page_type IF NOT EXISTS FOR (p:Page) ON (p.type)`,
    `CREATE INDEX page_title IF NOT EXISTS FOR (p:Page) ON (p.title)`,
    `CREATE INDEX link_type IF NOT EXISTS FOR ()-[r:LINKS_TO]-() ON (r.type)`,
  ];
  for (const cypher of constraints) {
    try {
      await runWrite(brainId, cypher);
    } catch (e: any) {
      if (!String(e?.message ?? "").includes("already exists")) {
        console.error(`[brainbase/neo4j] constraint error for ${brainId}:`, e.message);
      }
    }
  }
}

/** Ping the database — used by health checks and the optional /api/health route. */
export async function ping(): Promise<{ ok: true; mode: "single" | "multi" }> {
  await runQuery("neo4j", "RETURN 1 AS ok");
  return { ok: true, mode: SINGLE_DB_MODE ? "single" : "multi" };
}

export async function close(): Promise<void> {
  if (_driver) {
    await _driver.close();
    _driver = null;
    driverPromise = null;
  }
}
