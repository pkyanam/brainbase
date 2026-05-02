"use node";
/**
 * Brainbase API client for Convex actions.
 * Some operations proxy to Vercel endpoints; orphan linking runs directly on Supabase.
 */

import { queryMany } from "./supabase";
import { batchLinkOrphans } from "./orphanLinker";

const BASE_URL = process.env.BRAINBASE_API_URL || process.env.BRAINBASE_BASE_URL || "https://brainbase.belweave.ai";
const CRON_SECRET = process.env.API_CRON_SECRET || process.env.CRON_SECRET || "";

async function bbFetch(path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Brainbase API ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  return { ok: true, status: res.status };
}

/** List all brains that have pages, ordered by page count desc. */
export async function listBrains(): Promise<Array<{ brain_id: string; page_count: number }>> {
  const rows = await queryMany<{ brain_id: string; page_count: number }>(
    `SELECT brain_id, COUNT(*)::int as page_count
     FROM pages
     GROUP BY brain_id
     HAVING COUNT(*) > 0
     ORDER BY COUNT(*) DESC`
  );
  return rows;
}

/** Run one dream phase for one brain (proxies to Vercel for most phases). */
export async function runDreamPhase(brainId: string, phase: string, limit?: number): Promise<any> {
  return bbFetch("/api/cron/dream-phase", { brain_id: brainId, phase, limit });
}

/** Embed stale chunks for one brain. */
export async function embedBrainChunks(brainId: string, limit?: number): Promise<any> {
  return bbFetch("/api/cron/embed-brain", { brain_id: brainId, limit });
}

/** Process one minion worker tick. */
export async function runWorkerTick(queue: string = "default", batchSize: number = 5): Promise<any> {
  return bbFetch("/api/jobs/worker", { queue, batch: batchSize });
}

/** Link orphans directly on Supabase (runs on Convex, no Vercel proxy). */
export async function linkOrphansDirectly(brainId: string): Promise<any> {
  return batchLinkOrphans(brainId);
}
