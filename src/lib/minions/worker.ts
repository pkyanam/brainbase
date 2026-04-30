/**
 * Minion Worker — Cron-driven batch processor for serverless Vercel.
 *
 * Unlike GBrain's long-running polling loop, this worker is invoked by a
 * Vercel cron job. Each invocation claims and processes up to `batchSize`
 * jobs, respecting the 55s lock duration (well under Vercel Hobby's 60s limit).
 */

import { claimJobs, completeJob, failJob, promoteDelayed, recoverStalled, handleTimeouts } from './queue';
import { UnrecoverableError } from './types';
import type { MinionJob, MinionJobContext, MinionHandler } from './types';
import { randomUUID } from 'crypto';
import { query } from '../supabase/client';

const DEFAULT_BATCH_SIZE = 5;
const MAX_RUNTIME_MS = 50_000; // 50s — leave 10s margin for Vercel shutdown

interface WorkerResult {
  processed: number;
  succeeded: number;
  failed: number;
  timedOut: number;
  errors: string[];
}

const handlers = new Map<string, MinionHandler>();

export function register(name: string, handler: MinionHandler): void {
  handlers.set(name, handler);
}

function makeContext(
  job: MinionJob,
  startTime: number
): MinionJobContext {
  let logBuffer: string[] = [];

  return {
    id: job.id,
    name: job.name,
    data: job.data,
    brain_id: job.brain_id,
    attempts_made: job.attempts_made,

    async log(message: string): Promise<void> {
      logBuffer.push(message);
    },

    async updateProgress(progress: unknown): Promise<void> {
      // Progress is persisted via the result field on completion
    },

    isTimeRunningOut(): boolean {
      return (Date.now() - startTime) > MAX_RUNTIME_MS;
    },

    elapsedMs(): number {
      return Date.now() - startTime;
    },
  };
}

/**
 * Process one batch tick. Call this from a cron endpoint.
 * Does NOT run indefinitely — processes at most `batchSize` jobs and returns.
 */
export async function processTick(
  queueName: string = 'default',
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<WorkerResult> {
  const workerId = randomUUID().slice(0, 8);
  const lockToken = `wrk:${workerId}:${Date.now()}`;
  const result: WorkerResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    timedOut: 0,
    errors: [],
  };

  // 1. Promote delayed jobs
  try {
    const promoted = await promoteDelayed(queueName);
    if (promoted > 0) console.log(`[minions] Promoted ${promoted} delayed jobs`);
  } catch (e: unknown) {
    console.error('[minions] Promote error:', e instanceof Error ? e.message : String(e));
  }

  // 2. Recover stalled jobs
  try {
    const { requeued, dead } = await recoverStalled(queueName);
    if (requeued > 0 || dead > 0) {
      console.log(`[minions] Stall recovery: ${requeued} requeued, ${dead} dead-lettered`);
    }
  } catch (e: unknown) {
    console.error('[minions] Stall recovery error:', e instanceof Error ? e.message : String(e));
  }

  // 3. Handle timeouts
  try {
    const timedOut = await handleTimeouts(queueName);
    if (timedOut > 0) {
      console.log(`[minions] Timeout: ${timedOut} jobs dead-lettered`);
      result.timedOut += timedOut;
    }
  } catch (e: unknown) {
    console.error('[minions] Timeout error:', e instanceof Error ? e.message : String(e));
  }

  // 4. Claim and process jobs
  const claimed = await claimJobs(lockToken, queueName, batchSize);
  result.processed = claimed.length;

  if (claimed.length === 0) {
    console.log(`[minions] No jobs in queue '${queueName}', worker ${workerId} idle`);
    return result;
  }

  console.log(`[minions] Worker ${workerId} claimed ${claimed.length} jobs`);

  // Process each claimed job sequentially (we're on Vercel, need to be quick)
  for (const job of claimed) {
    const handler = handlers.get(job.name);
    if (!handler) {
      console.warn(`[minions] No handler registered for '${job.name}', failing job ${job.id}`);
      await failJob(
        job.id, lockToken,
        new Error(`No handler registered for job type '${job.name}'`)
      );
      result.failed++;
      continue;
    }

    const startTime = Date.now();
    const ctx = makeContext(job, startTime);

    try {
      const output = await handler(ctx);
      await completeJob(job.id, lockToken, output);
      result.succeeded++;
      console.log(`[minions] Job ${job.id} (${job.name}) completed`);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error(`[minions] Job ${job.id} (${job.name}) failed:`, err.message);
      await failJob(job.id, lockToken, err);
      result.failed++;
      result.errors.push(`Job ${job.id}: ${err.message}`);

      // If we're running out of time, stop processing and release remaining locks
      if (Date.now() - Date.parse(job.started_at ?? new Date().toISOString()) > MAX_RUNTIME_MS) {
        console.warn(`[minions] Approaching Vercel timeout — stopping batch after ${result.processed} jobs`);
        // Release remaining claimed jobs back to waiting
        const remainingIds = claimed
          .filter(j => j.status !== 'completed' && j.status !== 'failed' && j.status !== 'dead')
          .map(j => j.id);
        if (remainingIds.length > 0) {
          await query(
            `UPDATE minion_jobs
             SET status = 'waiting', lock_token = NULL, lock_until = NULL, updated_at = NOW()
             WHERE id = ANY($1::bigint[]) AND lock_token = $2`,
            [remainingIds, lockToken]
          );
        }
        break;
      }
    }
  }

  console.log(
    `[minions] Batch complete: ${result.succeeded} succeeded, ${result.failed} failed, ` +
    `${result.timedOut} timed out`
  );

  return result;
}
