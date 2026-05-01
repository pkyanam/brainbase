/** Shared types for the Dream Cycle pipeline. */

export interface DreamPhaseResult {
  phase: string;
  status: "completed" | "failed" | "skipped";
  summary: string;
  items_processed?: number;
  items_created?: number;
  details?: Record<string, unknown>;
  error?: string;
  duration_ms: number;
}

export interface DreamCycleResult {
  phases: DreamPhaseResult[];
  total_duration_ms: number;
}

/**
 * Run the full 8-phase dream cycle.
 * Uses processAll=false by default for incremental batches.
 */
export async function runDreamCycle(
  brainId: string,
  processAll = false
): Promise<DreamCycleResult> {
  const t0 = Date.now();
  const phases: DreamPhaseResult[] = [];

  // Phase 1: Lint
  // Phase 2: Backlinks
  // Phase 3: Sync
  // (These 3 are handled by the existing legacy dream phases via cron)

  // Phase 4: Synthesize
  try {
    const { runSynthesizePhase } = await import("./dream/synthesize");
    const result = await runSynthesizePhase(brainId);
    phases.push({
      phase: "synthesize",
      status: "completed",
      summary: `Scanned ${result.transcriptsScanned}, significant ${result.significantFound}, created ${result.pagesCreated}`,
      items_processed: result.transcriptsScanned,
      items_created: result.pagesCreated,
      duration_ms: 0,
    });
  } catch (err: any) {
    phases.push({
      phase: "synthesize",
      status: "failed",
      summary: err.message,
      duration_ms: 0,
    });
  }

  // Phase 5: Extract (links + timeline)
  phases.push({
    phase: "extract",
    status: "skipped",
    summary: "Extraction runs via sync/autopilot — deferred",
    duration_ms: 0,
  });

  // Phase 6: Patterns
  try {
    const { detectDreamPatterns } = await import("./dream/patterns");
    const result = await detectDreamPatterns(brainId, 30, 2);
    phases.push({
      phase: "patterns",
      status: result.status as "completed" | "failed" | "skipped",
      summary: result.summary,
      items_processed: result.items_processed,
      items_created: result.items_created,
      duration_ms: result.duration_ms,
    });
  } catch (err: any) {
    phases.push({
      phase: "patterns",
      status: "failed",
      summary: err.message,
      duration_ms: 0,
    });
  }

  // Phase 7: Embed (stale chunks)
  try {
    const { countStaleChunks, runEmbedPipeline } = await import("./embed-pipeline");
    const stale = await countStaleChunks(brainId);
    if (stale > 0 && processAll) {
      const result = await runEmbedPipeline(brainId, "stale");
      phases.push({
        phase: "embed",
        status: "completed",
        summary: `Embedded ${result.chunks_embedded}/${result.total_chunks} stale chunks`,
        items_processed: result.chunks_embedded,
        duration_ms: result.duration_ms,
      });
    } else {
      phases.push({
        phase: "embed",
        status: stale > 0 ? "skipped" : "completed",
        summary: stale > 0 ? `${stale} stale chunks (not processing — use process_all)` : "All chunks embedded",
        items_processed: 0,
        duration_ms: 0,
      });
    }
  } catch (err: any) {
    phases.push({
      phase: "embed",
      status: "failed",
      summary: err.message,
      duration_ms: 0,
    });
  }

  // Phase 8: Orphans
  phases.push({
    phase: "orphans",
    status: "skipped",
    summary: "Orphan detection runs via health checks — deferred",
    duration_ms: 0,
  });

  return {
    phases,
    total_duration_ms: Date.now() - t0,
  };
}
