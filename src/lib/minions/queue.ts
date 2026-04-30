/**
 * MinionQueue - Postgres-native job queue operations.
 *
 * All operations are stateless and serverless-safe. No long-running loops.
 * The "worker" is a cron-driven batch tick (see worker.ts).
 *
 * Lock design: SELECT ... FOR UPDATE SKIP LOCKED with a lock_token + lock_until.
 * Expired locks are re-claimed by the stall recovery tick.
 */

import { query, queryOne, queryMany } from '../supabase/client';
import type {
  MinionJob, MinionJobInput, MinionJobStatus,
  MinionStats, ChildDoneMessage,
} from './types';
import { rowToMinionJob, TERMINAL_STATUSES } from './types';

const LOCK_DURATION_MS = 55_000;

// --- Submit ---

export async function submitJob(
  name: string,
  opts?: Partial<MinionJobInput>
): Promise<MinionJob> {
  const jobName = name.trim();
  if (!jobName) throw new Error('Job name cannot be empty');

  const childStatus: MinionJobStatus = opts?.delay ? 'delayed' : 'waiting';
  const delayUntil = opts?.delay
    ? new Date(Date.now() + opts.delay).toISOString()
    : null;

  if (opts?.idempotency_key) {
    const existing = await queryOne<Record<string, unknown>>(
      'SELECT * FROM minion_jobs WHERE idempotency_key = $1',
      [opts.idempotency_key]
    );
    if (existing) return rowToMinionJob(existing);
  }

  const result = await queryOne<Record<string, unknown>>(
    `INSERT INTO minion_jobs (
      name, queue, status, priority, data, brain_id,
      max_attempts, delay_until, parent_job_id, depth,
      max_children, timeout_ms, idempotency_key, max_stalled
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
    RETURNING *`,
    [
      jobName,
      opts?.queue ?? 'default',
      childStatus,
      opts?.priority ?? 0,
      opts?.data ?? {},
      opts?.brain_id ?? null,
      opts?.max_attempts ?? 3,
      delayUntil,
      opts?.parent_job_id ?? null,
      opts?.depth ?? 0,
      opts?.max_children ?? null,
      opts?.timeout_ms ?? null,
      opts?.idempotency_key ?? null,
      opts?.max_stalled ?? 3,
    ]
  );

  if (!result && opts?.idempotency_key) {
    const existing = await queryOne<Record<string, unknown>>(
      'SELECT * FROM minion_jobs WHERE idempotency_key = $1',
      [opts.idempotency_key]
    );
    if (existing) return rowToMinionJob(existing);
    throw new Error('idempotency insert returned no row');
  }

  if (!result) throw new Error('Failed to submit job');

  if (opts?.parent_job_id) {
    await query(
      `UPDATE minion_jobs SET updated_at = NOW()
       WHERE id = $1 AND status NOT IN ('completed','failed','dead','cancelled')`,
      [opts.parent_job_id]
    );
  }

  return rowToMinionJob(result);
}

// --- Claim ---

export async function claimJob(
  lockToken: string,
  queueName: string = 'default',
): Promise<MinionJob | null> {
  const lockUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();

  await query("SELECT pg_advisory_xact_lock(hashtext('minion_claim:' || $1))", [queueName]);

  const row = await queryOne<Record<string, unknown>>(
    `UPDATE minion_jobs
     SET status = 'active',
         lock_token = $1,
         lock_until = $2,
         attempts_made = attempts_made + 1,
         started_at = COALESCE(started_at, NOW()),
         updated_at = NOW()
     WHERE id = (
       SELECT id FROM minion_jobs
       WHERE queue = $3
         AND status = 'waiting'
         AND delay_until IS NULL
       ORDER BY priority ASC, created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [lockToken, lockUntil, queueName]
  );

  return row ? rowToMinionJob(row) : null;
}

export async function claimJobs(
  lockToken: string,
  queueName: string = 'default',
  count: number = 5,
): Promise<MinionJob[]> {
  const lockUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();

  const ids = await queryMany<{ id: string }>(
    `SELECT id FROM minion_jobs
     WHERE queue = $1
       AND status = 'waiting'
       AND delay_until IS NULL
     ORDER BY priority ASC, created_at ASC
     LIMIT $2
     FOR UPDATE SKIP LOCKED`,
    [queueName, count]
  );

  if (ids.length === 0) return [];

  const idList = ids.map(r => parseInt(r.id, 10));
  const rows = await queryMany<Record<string, unknown>>(
    `UPDATE minion_jobs
     SET status = 'active',
         lock_token = $1,
         lock_until = $2,
         attempts_made = attempts_made + 1,
         started_at = COALESCE(started_at, NOW()),
         updated_at = NOW()
     WHERE id = ANY($3::bigint[])
     RETURNING *`,
    [lockToken, lockUntil, idList]
  );

  return rows.map(rowToMinionJob);
}

// --- Complete / Fail ---

export async function completeJob(
  id: number,
  lockToken: string,
  result?: unknown,
): Promise<MinionJob | null> {
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE minion_jobs
     SET status = 'completed',
         result = $3::jsonb,
         progress = NULL,
         finished_at = NOW(),
         lock_token = NULL,
         lock_until = NULL,
         updated_at = NOW()
     WHERE id = $1 AND lock_token = $2 AND status = 'active'
     RETURNING *`,
    [id, lockToken, result ? JSON.stringify(result) : null]
  );

  const job = row ? rowToMinionJob(row) : null;

  if (job?.parent_job_id) {
    await notifyParent(job.parent_job_id, id, job.name, 'complete', result, null);
  }

  return job;
}

export async function failJob(
  id: number,
  lockToken: string,
  error: Error,
): Promise<MinionJob | null> {
  const current = await queryOne<Record<string, unknown>>(
    'SELECT * FROM minion_jobs WHERE id = $1 AND lock_token = $2',
    [id, lockToken]
  );
  if (!current) return null;

  const job = rowToMinionJob(current);
  const attemptsSoFar = job.attempts_made;
  const maxAttempts = job.max_attempts;
  const isUnrecoverable = error.name === 'UnrecoverableError';

  if (isUnrecoverable || attemptsSoFar >= maxAttempts) {
    const finalStatus = isUnrecoverable ? 'dead' : 'failed';
    const row = await queryOne<Record<string, unknown>>(
      `UPDATE minion_jobs
       SET status = $3,
           error_text = $4,
           stacktrace = array_append(COALESCE(stacktrace, '{}'), $5),
           finished_at = NOW(),
           lock_token = NULL,
           lock_until = NULL,
           updated_at = NOW()
       WHERE id = $1 AND lock_token = $2 AND status = 'active'
       RETURNING *`,
      [id, lockToken, finalStatus, error.message, error.stack?.slice(0, 500) ?? error.message]
    );

    const failed = row ? rowToMinionJob(row) : null;
    if (failed?.parent_job_id) {
      await notifyParent(failed.parent_job_id, id, failed.name, 'failed', null, error.message);
    }
    return failed;
  }

  const backoffMs = Math.min(1000 * Math.pow(2, attemptsSoFar), 60_000);
  const delayUntil = new Date(Date.now() + backoffMs).toISOString();

  const row = await queryOne<Record<string, unknown>>(
    `UPDATE minion_jobs
     SET status = 'waiting',
         lock_token = NULL,
         lock_until = NULL,
         delay_until = $3,
         error_text = $4,
         stacktrace = array_append(COALESCE(stacktrace, '{}'), $5),
         updated_at = NOW()
     WHERE id = $1 AND lock_token = $2 AND status = 'active'
     RETURNING *`,
    [id, lockToken, delayUntil, error.message, error.stack?.slice(0, 500) ?? error.message]
  );

  return row ? rowToMinionJob(row) : null;
}

// --- Cancel ---

export async function cancelJob(id: number): Promise<MinionJob | null> {
  const rows = await queryMany<Record<string, unknown>>(
    `WITH RECURSIVE descendants AS (
      SELECT id, 0 AS d FROM minion_jobs WHERE id = $1
      UNION ALL
      SELECT m.id, descendants.d + 1
        FROM minion_jobs m
        JOIN descendants ON m.parent_job_id = descendants.id
        WHERE descendants.d < 100
    )
    UPDATE minion_jobs SET
      status = 'cancelled',
      lock_token = NULL,
      lock_until = NULL,
      finished_at = NOW(),
      updated_at = NOW()
    WHERE id IN (SELECT id FROM descendants)
      AND status NOT IN ('completed','failed','dead','cancelled')
    RETURNING *`,
    [id]
  );

  if (rows.length === 0) return null;

  for (const r of rows) {
    const parentJobId = r.parent_job_id as number | null;
    if (parentJobId) {
      await notifyParent(
        parentJobId, r.id as number, r.name as string,
        'cancelled', null, 'cancelled'
      );
    }
  }

  const root = rows.find(r => (r.id as number) === id);
  return root ? rowToMinionJob(root) : null;
}

// --- Retry ---

export async function retryJob(id: number): Promise<MinionJob | null> {
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE minion_jobs
     SET status = 'waiting', error_text = NULL,
         lock_token = NULL, lock_until = NULL,
         delay_until = NULL, finished_at = NULL,
         updated_at = NOW()
     WHERE id = $1 AND status IN ('failed', 'dead')
     RETURNING *`,
    [id]
  );
  return row ? rowToMinionJob(row) : null;
}

// --- Promote delayed ---

export async function promoteDelayed(queueName: string = 'default'): Promise<number> {
  const rows = await queryMany<{ count: string }>(
    `WITH promoted AS (
      UPDATE minion_jobs
      SET status = 'waiting', delay_until = NULL, updated_at = NOW()
      WHERE queue = $1 AND status = 'delayed' AND delay_until <= NOW()
      RETURNING id
    )
    SELECT count(*)::text AS count FROM promoted`,
    [queueName]
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

// --- Stall recovery ---

export async function recoverStalled(
  queueName: string = 'default',
): Promise<{ requeued: number; dead: number }> {
  const requeuedRows = await queryMany<{ count: string }>(
    `WITH requeued AS (
      UPDATE minion_jobs
      SET status = 'waiting', lock_token = NULL, lock_until = NULL,
          stalled_counter = stalled_counter + 1, updated_at = NOW()
      WHERE queue = $1 AND status = 'active'
        AND lock_until < NOW() AND stalled_counter < max_stalled
      RETURNING id
    )
    SELECT count(*)::text AS count FROM requeued`,
    [queueName]
  );

  const deadRows = await queryMany<{ count: string }>(
    `WITH dead AS (
      UPDATE minion_jobs
      SET status = 'dead',
          error_text = 'stalled: exceeded max_stalled',
          lock_token = NULL, lock_until = NULL,
          finished_at = NOW(), updated_at = NOW()
      WHERE queue = $1 AND status = 'active'
        AND lock_until < NOW() AND stalled_counter >= max_stalled
      RETURNING id
    )
    SELECT count(*)::text AS count FROM dead`,
    [queueName]
  );

  return {
    requeued: parseInt(requeuedRows[0]?.count ?? '0', 10),
    dead: parseInt(deadRows[0]?.count ?? '0', 10),
  };
}

// --- Timeouts ---

export async function handleTimeouts(queueName: string = 'default'): Promise<number> {
  const rows = await queryMany<{ count: string }>(
    `WITH timed_out AS (
      UPDATE minion_jobs
      SET status = 'dead', error_text = 'timeout exceeded',
          lock_token = NULL, lock_until = NULL,
          finished_at = NOW(), updated_at = NOW()
      WHERE queue = $1 AND status = 'active'
        AND timeout_at IS NOT NULL AND timeout_at < NOW()
      RETURNING id
    )
    SELECT count(*)::text AS count FROM timed_out`,
    [queueName]
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

// --- Queries ---

export async function getJob(id: number): Promise<MinionJob | null> {
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM minion_jobs WHERE id = $1', [id]
  );
  return row ? rowToMinionJob(row) : null;
}

export async function listJobs(opts?: {
  status?: MinionJobStatus;
  queue?: string;
  name?: string;
  brain_id?: string;
  limit?: number;
  offset?: number;
}): Promise<MinionJob[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (opts?.status) { conditions.push('status = $' + idx++); params.push(opts.status); }
  if (opts?.queue) { conditions.push('queue = $' + idx++); params.push(opts.queue); }
  if (opts?.name) { conditions.push('name = $' + idx++); params.push(opts.name); }
  if (opts?.brain_id) { conditions.push('brain_id = $' + idx++); params.push(opts.brain_id); }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const rows = await queryMany<Record<string, unknown>>(
    'SELECT * FROM minion_jobs ' + where +
    ' ORDER BY created_at DESC LIMIT $' + idx++ + ' OFFSET $' + idx,
    [...params, limit, offset]
  );

  return rows.map(rowToMinionJob);
}

// --- Stats ---

export async function getStats(): Promise<MinionStats> {
  const statusRows = await queryMany<{ status: string; count: string }>(
    'SELECT status, count(*)::text as count FROM minion_jobs GROUP BY status'
  );

  const by_status: Record<string, number> = {};
  for (const r of statusRows) by_status[r.status] = parseInt(r.count, 10);

  const healthRows = await queryMany<{ waiting: string; active: string; stalled: string; delayed: string }>(
    `SELECT
      COUNT(*) FILTER (WHERE status = 'waiting' AND delay_until IS NULL)::text as waiting,
      COUNT(*) FILTER (WHERE status = 'active')::text as active,
      COUNT(*) FILTER (WHERE status = 'active' AND lock_until < NOW())::text as stalled,
      COUNT(*) FILTER (WHERE status = 'delayed')::text as delayed
     FROM minion_jobs`
  );
  const h = healthRows[0];

  return {
    by_status,
    queue_health: {
      waiting: parseInt(h?.waiting ?? '0', 10),
      active: parseInt(h?.active ?? '0', 10),
      stalled: parseInt(h?.stalled ?? '0', 10),
      delayed: parseInt(h?.delayed ?? '0', 10),
    },
  };
}

// --- Prune ---

export async function pruneJobs(olderThanDays: number = 30): Promise<number> {
  const rows = await queryMany<{ id: string }>(
    `DELETE FROM minion_jobs
     WHERE status = ANY($1)
       AND updated_at < NOW() - INTERVAL '${olderThanDays} days'
     RETURNING id`,
    [TERMINAL_STATUSES]
  );
  return rows.length;
}

// --- Inbox ---

async function notifyParent(
  parentJobId: number,
  childId: number,
  jobName: string,
  outcome: ChildDoneMessage['outcome'],
  result: unknown,
  error: string | null,
): Promise<void> {
  const msg: ChildDoneMessage = {
    type: 'child_done',
    child_id: childId,
    job_name: jobName,
    result,
    outcome,
    error,
  };

  await query(
    `INSERT INTO minion_inbox (job_id, sender, payload)
     VALUES ($1, 'minions', $2::jsonb)`,
    [parentJobId, JSON.stringify(msg)]
  );
}

export async function getInboxMessages(
  jobId: number,
  markRead: boolean = true,
): Promise<Array<{ id: number; sender: string; payload: unknown; sent_at: string }>> {
  const rows = await queryMany<Record<string, unknown>>(
    'SELECT * FROM minion_inbox WHERE job_id = $1 AND read_at IS NULL ORDER BY sent_at ASC',
    [jobId]
  );

  if (markRead && rows.length > 0) {
    await query(
      'UPDATE minion_inbox SET read_at = NOW() WHERE job_id = $1 AND read_at IS NULL',
      [jobId]
    );
  }

  return rows.map(r => ({
    id: r.id as number,
    sender: r.sender as string,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
    sent_at: r.sent_at as string,
  }));
}
