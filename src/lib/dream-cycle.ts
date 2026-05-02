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
 * Run the full dream cycle.
 * Processes ALL phases — no more stubs. The brain actually gets smarter.
 */
export async function runDreamCycle(
  brainId: string,
  processAll = false
): Promise<DreamCycleResult> {
  const t0 = Date.now();
  const phases: DreamPhaseResult[] = [];

  // ── Phase 1: Extract links from ALL unprocessed pages ──────
  {
    const p0 = Date.now();
    try {
      const { extractLinksFromStalePages } = await import("./auto-extract");
      const result = await extractLinksFromStalePages(brainId, processAll ? 1000 : 200);
      phases.push({
        phase: "extract_links",
        status: "completed",
        summary: `${result.pagesScanned} pages scanned, ${result.linksCreated} links created, ${result.timelineEntries} timeline entries`,
        items_processed: result.pagesScanned,
        items_created: result.linksCreated,
        duration_ms: Date.now() - p0,
      });
    } catch (err: any) {
      phases.push({
        phase: "extract_links",
        status: "failed",
        summary: err.message,
        duration_ms: Date.now() - p0,
      });
    }
  }

  // ── Phase 1b: Link tweets to their authors ──────────────
  {
    const p0 = Date.now();
    try {
      const { linkTweetsToAuthors } = await import("./tweet-linker");
      const result = await linkTweetsToAuthors(brainId, 500);
      phases.push({
        phase: "tweet_author_link",
        status: "completed",
        summary: `${result.tweetsScanned} tweets scanned, ${result.linked} linked to authors, ${result.noHandle} no-handle, ${result.errors} errors`,
        items_processed: result.tweetsScanned,
        items_created: result.linked,
        duration_ms: Date.now() - p0,
      });
    } catch (err: any) {
      phases.push({
        phase: "tweet_author_link",
        status: "failed",
        summary: err.message,
        duration_ms: Date.now() - p0,
      });
    }
  }

  // ── Phase 2: Link orphans via vector + FTS similarity ─────
  {
    const p0 = Date.now();
    try {
      const { batchLinkOrphans } = await import("./orphan-linker");
      const result = await batchLinkOrphans(brainId);
      phases.push({
        phase: "link_orphans",
        status: "completed",
        summary: `${result.orphansFound} orphans found, ${result.totalInserted} links created (v:${result.vectorPairs} fts:${result.ftsPairs} title:${result.titlePairs})`,
        items_processed: result.orphansFound,
        items_created: result.totalInserted,
        details: result.diagnostics || {},
        duration_ms: Date.now() - p0,
      });
    } catch (err: any) {
      phases.push({
        phase: "link_orphans",
        status: "failed",
        summary: err.message,
        duration_ms: Date.now() - p0,
      });
    }
  }

  // ── Phase 3: Synthesize meeting transcripts ───────────────
  {
    const p0 = Date.now();
    try {
      const { runSynthesizePhase } = await import("./dream/synthesize");
      const result = await runSynthesizePhase(brainId);
      phases.push({
        phase: "synthesize",
        status: "completed",
        summary: `Scanned ${result.transcriptsScanned}, significant ${result.significantFound}, created ${result.pagesCreated}`,
        items_processed: result.transcriptsScanned,
        items_created: result.pagesCreated,
        duration_ms: Date.now() - p0,
      });
    } catch (err: any) {
      phases.push({
        phase: "synthesize",
        status: "failed",
        summary: err.message,
        duration_ms: Date.now() - p0,
      });
    }
  }

  // ── Phase 4: Detect patterns ──────────────────────────────
  {
    const p0 = Date.now();
    try {
      const { detectDreamPatterns } = await import("./dream/patterns");
      const result = await detectDreamPatterns(brainId, 30, 2);
      phases.push({
        phase: "patterns",
        status: result.status as "completed" | "failed" | "skipped",
        summary: result.summary,
        items_processed: result.items_processed,
        items_created: result.items_created,
        duration_ms: Date.now() - p0,
      });
    } catch (err: any) {
      phases.push({
        phase: "patterns",
        status: "failed",
        summary: err.message,
        duration_ms: Date.now() - p0,
      });
    }
  }

  // ── Phase 5: Embed stale chunks ───────────────────────────
  {
    const p0 = Date.now();
    try {
      const { countStaleChunks, runEmbedPipeline } = await import("./embed-pipeline");
      const stale = await countStaleChunks(brainId);
      if (stale > 0) {
        const result = await runEmbedPipeline(brainId, "stale");
        phases.push({
          phase: "embed",
          status: "completed",
          summary: `Embedded ${result.chunks_embedded}/${stale} stale chunks`,
          items_processed: result.chunks_embedded,
          duration_ms: Date.now() - p0,
        });
      } else {
        phases.push({
          phase: "embed",
          status: "completed",
          summary: "All chunks embedded",
          duration_ms: Date.now() - p0,
        });
      }
    } catch (err: any) {
      phases.push({
        phase: "embed",
        status: "failed",
        summary: err.message,
        duration_ms: Date.now() - p0,
      });
    }
  }

  return {
    phases,
    total_duration_ms: Date.now() - t0,
  };
}
