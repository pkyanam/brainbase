/**
 * Minions — Postgres-native job queue for Brainbase.
 *
 * Adapted from GBrain's `src/core/minions/types.ts` for serverless Vercel.
 * The key difference: workers are cron-driven batch ticks, not long-running
 * polling loops. Lock expiration handles crash recovery naturally.
 */

// --- Status & Type Unions ---

export type MinionJobStatus =
  | 'waiting'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'dead'
  | 'cancelled';

export const TERMINAL_STATUSES: MinionJobStatus[] = [
  'completed', 'failed', 'dead', 'cancelled',
];

export const PROCESSABLE_STATUSES: MinionJobStatus[] = [
  'waiting', 'active', 'delayed',
];

// --- Job Record ---

export interface MinionJob {
  id: number;
  name: string;
  queue: string;
  status: MinionJobStatus;
  priority: number;
  data: Record<string, unknown>;
  brain_id: string | null;

  // Retry
  max_attempts: number;
  attempts_made: number;

  // Lock / claim
  lock_token: string | null;
  lock_until: string | null; // ISO timestamp
  max_stalled: number;
  stalled_counter: number;

  // Scheduling
  delay_until: string | null; // ISO timestamp

  // Timeout
  timeout_ms: number | null;
  timeout_at: string | null; // ISO timestamp

  // Dependencies
  parent_job_id: number | null;
  on_child_fail: string;
  depth: number;
  max_children: number | null;

  // Idempotency
  idempotency_key: string | null;

  // Results
  result: Record<string, unknown> | null;
  progress: unknown | null;
  error_text: string | null;
  stacktrace: string[];

  // Timestamps
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

// --- Input Types ---

export interface MinionJobInput {
  name: string;
  data?: Record<string, unknown>;
  queue?: string;
  brain_id?: string;
  priority?: number;
  max_attempts?: number;
  delay?: number; // ms delay before eligible
  parent_job_id?: number;
  depth?: number;
  max_children?: number;
  timeout_ms?: number;
  idempotency_key?: string;
  max_stalled?: number;
}

// --- Job Context (passed to handlers) ---

export interface MinionJobContext {
  id: number;
  name: string;
  data: Record<string, unknown>;
  brain_id: string | null;
  attempts_made: number;

  /** Log a message to the job's stacktrace. */
  log(message: string): Promise<void>;

  /** Update structured progress. */
  updateProgress(progress: unknown): Promise<void>;

  /** Check if over the Vercel function timeout (55s safety margin for 60s Hobby limit). */
  isTimeRunningOut(): boolean;

  /** Elapsed wall time since job start in ms. */
  elapsedMs(): number;
}

export type MinionHandler = (job: MinionJobContext) => Promise<unknown>;

// --- Inbox Message ---

export interface InboxMessage {
  id: number;
  job_id: number;
  sender: string;
  payload: unknown;
  read_at: string | null;
  sent_at: string;
}

// --- Child Done Message ---

export interface ChildDoneMessage {
  type: 'child_done';
  child_id: number;
  job_name: string;
  result: unknown;
  outcome: 'complete' | 'failed' | 'dead' | 'cancelled' | 'timeout';
  error?: string | null;
}

// --- Queue Stats ---

export interface MinionStats {
  by_status: Record<string, number>;
  queue_health: {
    waiting: number;
    active: number;
    stalled: number;
    delayed: number;
  };
}

// --- Error ---

/** Throw from a handler to skip all retry logic. */
export class UnrecoverableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnrecoverableError';
  }
}

// --- Row Mapping ---

export function rowToMinionJob(row: Record<string, unknown>): MinionJob {
  return {
    id: row.id as number,
    name: row.name as string,
    queue: row.queue as string,
    status: row.status as MinionJobStatus,
    priority: row.priority as number,
    data: typeof row.data === 'string'
      ? JSON.parse(row.data)
      : (row.data as Record<string, unknown> ?? {}),
    brain_id: (row.brain_id as string) || null,
    max_attempts: row.max_attempts as number,
    attempts_made: row.attempts_made as number,
    lock_token: (row.lock_token as string) || null,
    lock_until: (row.lock_until as string) || null,
    max_stalled: row.max_stalled as number,
    stalled_counter: row.stalled_counter as number,
    delay_until: (row.delay_until as string) || null,
    timeout_ms: (row.timeout_ms as number) || null,
    timeout_at: (row.timeout_at as string) || null,
    parent_job_id: (row.parent_job_id as number) || null,
    on_child_fail: row.on_child_fail as string,
    depth: (row.depth as number) ?? 0,
    max_children: (row.max_children as number) || null,
    idempotency_key: (row.idempotency_key as string) || null,
    result: row.result
      ? (typeof row.result === 'string' ? JSON.parse(row.result) : row.result) as Record<string, unknown>
      : null,
    progress: row.progress
      ? (typeof row.progress === 'string' ? JSON.parse(row.progress) : row.progress)
      : null,
    error_text: (row.error_text as string) || null,
    stacktrace: Array.isArray(row.stacktrace) ? row.stacktrace as string[] : [],
    created_at: row.created_at as string,
    started_at: (row.started_at as string) || null,
    finished_at: (row.finished_at as string) || null,
    updated_at: row.updated_at as string,
  };
}
