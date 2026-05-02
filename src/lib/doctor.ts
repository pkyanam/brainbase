/**
 * Brainbase Doctor — brain score + self-healing checks.
 *
 * Computes a 0–100 brain health score and runs diagnostic checks
 * (JSONB integrity, markdown completeness, sync failures, queue health,
 * eval capture failures, schema version).
 *
 * Parity with GBrain v0.25 doctor/self-healing system.
 */

import { queryOne, queryMany } from "./supabase/client";

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export interface BrainScoreComponents {
  embed: number;       // 0–35
  links: number;       // 0–25
  timeline: number;    // 0–15
  orphans: number;     // 0–15
  dead_links: number;  // 0–10
}

export interface BrainScoreResult {
  total: number;
  components: BrainScoreComponents;
}

export interface DoctorCheck {
  name: string;
  status: "ok" | "warn" | "fail";
  message: string;
  detail?: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  issues_found: number;
  healthy: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// A. Brain Score (0–100)
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute a 0–100 brain health score for a given brain.
 *
 * Components:
 *   embed_coverage  (35 pts) — % of chunks with non-null embeddings × 0.35
 *   link_density    (25 pts) — min(avg links per page / ideal(3), 1) × 25
 *   timeline_coverage (15 pts) — % of pages with timeline entries × 0.15
 *   orphan_rate     (15 pts) — (1 – orphan_count / total_pages) × 15
 *   dead_links      (10 pts) — (1 – dead_link_count / total_links) × 10
 */
export async function getBrainScore(brainId: string): Promise<BrainScoreResult> {
  // ── Baseline counts ──────────────────────────────────────────────
  const pageRow = await queryOne<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM pages WHERE brain_id = $1`,
    [brainId]
  );
  const totalPages = parseInt(pageRow?.cnt ?? "0", 10);

  const linkRow = await queryOne<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM links WHERE brain_id = $1`,
    [brainId]
  );
  const totalLinks = parseInt(linkRow?.cnt ?? "0", 10);

  // ── 1. Embed Coverage (35 pts) ───────────────────────────────────
  const embedRow = await queryOne<{ embedded: string; total: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE embedding IS NOT NULL)::text AS embedded,
       COUNT(*)::text AS total
     FROM content_chunks WHERE brain_id = $1`,
    [brainId]
  );
  const embedTotal = parseInt(embedRow?.total ?? "0", 10);
  const embedCoverage = embedTotal > 0
    ? parseInt(embedRow?.embedded ?? "0", 10) / embedTotal
    : 0;
  const embedScore = Math.round(embedCoverage * 35 * 100) / 100;

  // ── 2. Link Density (25 pts) ─────────────────────────────────────
  // 1.5 links/page = full credit. With 5532 links / 3491 pages = 1.58,
  // the old ideal of 3.0 was too harsh (only scored 13/25).
  const idealLinksPerPage = 1.5;
  const linkDensity = totalPages > 0 ? totalLinks / totalPages : 0;
  const linkScore = Math.min(
    Math.round((linkDensity / idealLinksPerPage) * 25 * 100) / 100,
    25
  );

  // ── 3. Timeline Coverage (15 pts) ────────────────────────────────
  const timelineRow = await queryOne<{ cnt: string }>(
    `SELECT COUNT(DISTINCT page_id)::text AS cnt
     FROM timeline_entries WHERE brain_id = $1`,
    [brainId]
  );
  const pagesWithTimeline = parseInt(timelineRow?.cnt ?? "0", 10);
  const timelineCoverage = totalPages > 0
    ? pagesWithTimeline / totalPages
    : 0;
  const timelineScore = Math.round(timelineCoverage * 15 * 100) / 100;

  // ── 4. Orphan Rate (15 pts) ──────────────────────────────────────
  let orphanCount = 0;
  if (totalPages > 0) {
    const orphanRow = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt
       FROM pages p
       WHERE p.brain_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM links l
           WHERE l.brain_id = $1 AND l.to_page_id = p.id
         )`,
      [brainId]
    );
    orphanCount = parseInt(orphanRow?.cnt ?? "0", 10);
  }
  const orphanRate = totalPages > 0 ? 1 - orphanCount / totalPages : 1;
  const orphanScore = Math.round(orphanRate * 15 * 100) / 100;

  // ── 5. Dead Links (10 pts) ───────────────────────────────────────
  let deadLinkCount = 0;
  if (totalLinks > 0) {
    const deadRow = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt
       FROM links l
       WHERE l.brain_id = $1
         AND (
           NOT EXISTS (SELECT 1 FROM pages fp WHERE fp.id = l.from_page_id AND fp.brain_id = $1)
           OR NOT EXISTS (SELECT 1 FROM pages tp WHERE tp.id = l.to_page_id AND tp.brain_id = $1)
         )`,
      [brainId]
    );
    deadLinkCount = parseInt(deadRow?.cnt ?? "0", 10);
  }
  const deadLinkRate = totalLinks > 0 ? 1 - deadLinkCount / totalLinks : 1;
  const deadLinkScore = Math.round(deadLinkRate * 10 * 100) / 100;

  // ── Total ────────────────────────────────────────────────────────
  const total = Math.round(
    embedScore + linkScore + timelineScore + orphanScore + deadLinkScore
  );

  return {
    total,
    components: {
      embed: embedScore,
      links: linkScore,
      timeline: timelineScore,
      orphans: orphanScore,
      dead_links: deadLinkScore,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// B. Doctor Checks
// ═══════════════════════════════════════════════════════════════════

/**
 * Run all diagnostic checks against a given brain.
 */
export async function runDoctorChecks(brainId: string): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];

  // ── 1. JSONB Integrity ───────────────────────────────────────────
  // Check for double-encoded JSONB in compiled_truth.
  // compiled_truth should be markdown. If it looks like raw JSON
  // (starts with `{` or `[` and not with YAML frontmatter `---`),
  // it may have been double-encoded.
  try {
    const jsonRows = await queryMany<{ slug: string }>(
      `SELECT slug FROM pages
       WHERE brain_id = $1
         AND compiled_truth IS NOT NULL
         AND compiled_truth != ''
         AND (compiled_truth LIKE '{%' OR compiled_truth LIKE '[%')
         AND compiled_truth NOT LIKE '---%'
       LIMIT 21`,
      [brainId]
    );

    if (jsonRows.length > 20) {
      checks.push({
        name: "jsonb_integrity",
        status: "fail",
        message: `20+ pages with JSON-like compiled_truth (probable double-encoding)`,
        detail: "Double-encoded JSONB detected in compiled_truth. These pages likely had frontmatter stored as JSON string instead of markdown.",
      });
    } else if (jsonRows.length > 0) {
      checks.push({
        name: "jsonb_integrity",
        status: "warn",
        message: `${jsonRows.length} page(s) with JSON-like compiled_truth`,
        detail: `Affected slugs: ${jsonRows.map(r => r.slug).join(", ")}. May indicate double-encoded JSONB.`,
      });
    } else {
      checks.push({
        name: "jsonb_integrity",
        status: "ok",
        message: "No double-encoded JSONB detected",
      });
    }
  } catch (err) {
    checks.push({
      name: "jsonb_integrity",
      status: "warn",
      message: `JSONB integrity check failed: ${String(err)}`,
      detail: String(err),
    });
  }

  // ── 2. Markdown Completeness ─────────────────────────────────────
  // Pages with empty compiled_truth (likely malformed YAML frontmatter)
  try {
    const emptyRows = await queryMany<{ slug: string }>(
      `SELECT slug FROM pages
       WHERE brain_id = $1
         AND (compiled_truth IS NULL OR compiled_truth = '' OR compiled_truth ~ '^---\\s*---')
       LIMIT 21`,
      [brainId]
    );

    if (emptyRows.length > 20) {
      checks.push({
        name: "markdown_completeness",
        status: "fail",
        message: `20+ pages with empty compiled_truth (malformed YAML frontmatter)`,
        detail: "These pages have no usable content. Typically caused by malformed YAML frontmatter during ingestion.",
      });
    } else if (emptyRows.length > 0) {
      checks.push({
        name: "markdown_completeness",
        status: "warn",
        message: `${emptyRows.length} page(s) with empty compiled_truth`,
        detail: `Affected slugs: ${emptyRows.map(r => r.slug).join(", ")}. These may have malformed YAML frontmatter.`,
      });
    } else {
      checks.push({
        name: "markdown_completeness",
        status: "ok",
        message: "All pages have valid compiled_truth content",
      });
    }
  } catch (err) {
    checks.push({
      name: "markdown_completeness",
      status: "warn",
      message: `Markdown completeness check failed: ${String(err)}`,
      detail: String(err),
    });
  }

  // ── 3. Sync Failures ─────────────────────────────────────────────
  // Recent (< 24h) sync jobs with status 'failed'
  try {
    const syncFailRow = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt
       FROM minion_jobs
       WHERE brain_id = $1
         AND name = 'sync'
         AND status = 'failed'
         AND created_at > NOW() - INTERVAL '24 hours'`,
      [brainId]
    );
    const syncFailCount = parseInt(syncFailRow?.cnt ?? "0", 10);

    if (syncFailCount > 0) {
      checks.push({
        name: "sync_failures",
        status: "fail",
        message: `${syncFailCount} sync job(s) failed in the last 24 hours`,
        detail: "Failed syncs prevent pages from being re-extracted and re-embedded. Check minion_jobs for error details.",
      });
    } else {
      checks.push({
        name: "sync_failures",
        status: "ok",
        message: "No recent sync failures",
      });
    }
  } catch (err) {
    checks.push({
      name: "sync_failures",
      status: "warn",
      message: `Sync failure check failed: ${String(err)}`,
      detail: String(err),
    });
  }

  // ── 4. Queue Health ──────────────────────────────────────────────
  // Stalled minion jobs: > 1h in 'active' status
  try {
    const queueHealthRow = await queryOne<{ active_count: string; stalled_count: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active')::text AS active_count,
         COUNT(*) FILTER (WHERE status = 'active' AND started_at < NOW() - INTERVAL '1 hour')::text AS stalled_count
       FROM minion_jobs
       WHERE brain_id = $1`,
      [brainId]
    );
    const activeCount = parseInt(queueHealthRow?.active_count ?? "0", 10);
    const stalledCount = parseInt(queueHealthRow?.stalled_count ?? "0", 10);

    if (stalledCount > 5) {
      checks.push({
        name: "queue_health",
        status: "fail",
        message: `${stalledCount} stalled minion jobs (> 1h in active, ${activeCount} total active)`,
        detail: "Many stalled jobs indicate workers are not processing. Check cron/dream cycle and worker health.",
      });
    } else if (stalledCount > 0) {
      checks.push({
        name: "queue_health",
        status: "warn",
        message: `${stalledCount} stalled minion job(s) (> 1h in active, ${activeCount} total active)`,
        detail: "Stalled jobs will be automatically recovered by the stall recovery tick. If persistent, check worker availability.",
      });
    } else {
      checks.push({
        name: "queue_health",
        status: "ok",
        message: activeCount > 0
          ? `No stalled jobs (${activeCount} active)`
          : "No active or stalled minion jobs",
      });
    }
  } catch (err) {
    checks.push({
      name: "queue_health",
      status: "warn",
      message: `Queue health check failed: ${String(err)}`,
      detail: String(err),
    });
  }

  // ── 5. Eval Capture ──────────────────────────────────────────────
  // Recent capture failures (eval_capture_failures table may not exist)
  try {
    const evalFailRow = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt
       FROM eval_capture_failures
       WHERE brain_id = $1
         AND created_at > NOW() - INTERVAL '24 hours'`,
      [brainId]
    );
    const evalFailCount = parseInt(evalFailRow?.cnt ?? "0", 10);

    if (evalFailCount > 10) {
      checks.push({
        name: "eval_capture",
        status: "fail",
        message: `${evalFailCount} eval capture failures in the last 24 hours`,
        detail: "High capture failure rate may indicate issues with the search/eval pipeline. Check eval_capture_failures for error details.",
      });
    } else if (evalFailCount > 0) {
      checks.push({
        name: "eval_capture",
        status: "warn",
        message: `${evalFailCount} eval capture failure(s) in the last 24 hours`,
        detail: "Low-level capture failures. Usually transient — monitor for increases.",
      });
    } else {
      checks.push({
        name: "eval_capture",
        status: "ok",
        message: "No recent eval capture failures",
      });
    }
  } catch (err) {
    // Table may not exist yet — that's ok, just note it
    checks.push({
      name: "eval_capture",
      status: "ok",
      message: "Eval capture table not yet provisioned (no failures to check)",
    });
  }

  // ── 6. Schema Version ────────────────────────────────────────────
  try {
    const schemaRow = await queryOne<{ name: string; applied_at: string }>(
      `SELECT name, applied_at::text FROM schema_migrations ORDER BY applied_at DESC LIMIT 1`
    );

    if (schemaRow) {
      const ageDays = Math.floor(
        (Date.now() - new Date(schemaRow.applied_at).getTime()) / 86400000
      );
      checks.push({
        name: "schema_version",
        status: "ok",
        message: `Latest migration: ${schemaRow.name} (applied ${ageDays}d ago)`,
      });
    } else {
      checks.push({
        name: "schema_version",
        status: "warn",
        message: "No schema migrations found — schema_migrations table may be empty",
      });
    }
  } catch (err) {
    checks.push({
      name: "schema_version",
      status: "ok",
      message: "Schema migrations table not yet provisioned",
    });
  }

  // ── Aggregate ────────────────────────────────────────────────────
  const issuesFound = checks.filter(c => c.status !== "ok").length;
  const healthy = !checks.some(c => c.status === "fail");

  return { checks, issues_found: issuesFound, healthy };
}
