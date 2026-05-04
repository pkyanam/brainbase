import { query } from "./supabase/client";

/**
 * Idempotent schema setup for Brainbase multi-tenancy.
 * Run this on app boot or first request.
 */
export async function ensureSchema(): Promise<void> {
  try {
    // Brains table — each user gets one (or more) brain
    await query(`
      CREATE TABLE IF NOT EXISTS brains (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT 'My Brain',
        slug TEXT UNIQUE,
        supabase_url TEXT,
        supabase_key TEXT,
        encrypted_supabase_key TEXT,
        encrypted_supabase_key_iv TEXT,
        encrypted_supabase_key_tag TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // API keys table
    await query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brain_id UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_used_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ
      )
    `);

    // Create index for fast key lookups
    await query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)
      WHERE revoked_at IS NULL
    `);

    // Create index for brain lookups by owner
    await query(`
      CREATE INDEX IF NOT EXISTS idx_brains_owner ON brains(owner_user_id)
    `);

    // Insert default brain for legacy data if none exists
    await query(
      `INSERT INTO brains (id, owner_user_id, name, slug)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      ['00000000-0000-0000-0000-000000000001', 'legacy', "Legacy Brain", 'legacy']
    );

    // Add brain_id to pages (idempotent)
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pages') THEN
          ALTER TABLE pages ADD COLUMN IF NOT EXISTS brain_id UUID;
          UPDATE pages SET brain_id = '00000000-0000-0000-0000-000000000001' WHERE brain_id IS NULL;
          ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_brain_slug_unique;
          ALTER TABLE pages ADD CONSTRAINT pages_brain_slug_unique UNIQUE (brain_id, slug);
        END IF;
      END $$;
    `);

    // Add brain_id to links
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'links') THEN
          ALTER TABLE links ADD COLUMN IF NOT EXISTS brain_id UUID;
          UPDATE links SET brain_id = '00000000-0000-0000-0000-000000000001' WHERE brain_id IS NULL;
        END IF;
      END $$;
    `);

    // Add brain_id to content_chunks
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_chunks') THEN
          ALTER TABLE content_chunks ADD COLUMN IF NOT EXISTS brain_id UUID;
          UPDATE content_chunks SET brain_id = '00000000-0000-0000-0000-000000000001' WHERE brain_id IS NULL;
        END IF;
      END $$;
    `);

    // Add brain_id to timeline_entries
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'timeline_entries') THEN
          ALTER TABLE timeline_entries ADD COLUMN IF NOT EXISTS brain_id UUID;
          UPDATE timeline_entries SET brain_id = '00000000-0000-0000-0000-000000000001' WHERE brain_id IS NULL;
        END IF;
      END $$;
    `);

    // Add written_by to pages (agent attribution)
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pages') THEN
          ALTER TABLE pages ADD COLUMN IF NOT EXISTS written_by TEXT;
        END IF;
      END $$;
    `);

    // Add written_by to links
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'links') THEN
          ALTER TABLE links ADD COLUMN IF NOT EXISTS written_by TEXT;
        END IF;
      END $$;
    `);

    // Add written_by to timeline_entries
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'timeline_entries') THEN
          ALTER TABLE timeline_entries ADD COLUMN IF NOT EXISTS written_by TEXT;
        END IF;
      END $$;
    `);

    // Add last_extracted_at for dream cycle tracking
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pages') THEN
          ALTER TABLE pages ADD COLUMN IF NOT EXISTS last_extracted_at TIMESTAMPTZ;
        END IF;
      END $$;
    `);

    // ── Eval tables (BrainBench-Real) ────────
    await query(`
      CREATE TABLE IF NOT EXISTS eval_candidates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brain_id UUID NOT NULL,
        tool TEXT NOT NULL,
        query_text TEXT NOT NULL,
        result_count INTEGER,
        top_slugs TEXT[],
        meta JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_eval_candidates_brain_tool ON eval_candidates(brain_id, tool, created_at)`);

    await query(`
      CREATE TABLE IF NOT EXISTS eval_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brain_id UUID NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        total_queries INTEGER DEFAULT 0,
        avg_mrr DOUBLE PRECISION,
        avg_p3 DOUBLE PRECISION,
        avg_p5 DOUBLE PRECISION,
        avg_latency_ms DOUBLE PRECISION,
        passed INTEGER DEFAULT 0,
        failed INTEGER DEFAULT 0,
        baseline_id UUID REFERENCES eval_runs(id) ON DELETE SET NULL,
        meta JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_eval_runs_brain ON eval_runs(brain_id, created_at DESC)`);

    await query(`
      CREATE TABLE IF NOT EXISTS eval_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
        query_text TEXT NOT NULL,
        returned_slugs TEXT[],
        expected_slugs TEXT[],
        mrr DOUBLE PRECISION,
        p3 DOUBLE PRECISION,
        p5 DOUBLE PRECISION,
        latency_ms DOUBLE PRECISION,
        passed BOOLEAN,
        raw_meta JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_eval_results_run ON eval_results(run_id, passed)`);

    await query(`
      CREATE TABLE IF NOT EXISTS eval_capture_failures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brain_id UUID NOT NULL,
        tool TEXT,
        query_text TEXT,
        reason TEXT NOT NULL,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log("[brainbase] Schema ensured (multi-tenant)");

    // v0.5 — Ensure new tables/columns exist (idempotent)
    await ensureRawDataSchema();
    await ensureTagsColumn();
    // v0.6 — Public wiki schema
    await ensureWikiSchema();
    // v0.6 — Webhooks
    await ensureWebhooksSchema();
  } catch (err) {
    console.error("[brainbase] Schema setup error:", err);
  }
}

/**
 * v0.3 — Collaboration schema: brain members, invites, page versions, activities
 */
export async function ensureCollaborationSchema(): Promise<void> {
  // Ensure each table/index independently so one failure doesn't block the rest
  const ensureTable = async (label: string, sql: string) => {
    try {
      await query(sql);
    } catch (err) {
      console.error(`[brainbase] Schema ensure failed for ${label}:`, err);
    }
  };

  await ensureTable("brain_members", `
    CREATE TABLE IF NOT EXISTS brain_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brain_id UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(brain_id, user_id)
    )
  `);

  await ensureTable("brain_invites", `
    CREATE TABLE IF NOT EXISTS brain_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brain_id UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
      inviter_user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'editor',
      accepted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
    )
  `);

  await ensureTable("page_versions", `
    CREATE TABLE IF NOT EXISTS page_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brain_id UUID NOT NULL,
      page_slug TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT,
      content TEXT,
      frontmatter JSONB,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Ensure brain_id exists on page_versions (backfill from older deploys)
  await ensureTable("page_versions_brain_id_col", `
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'page_versions') THEN
        ALTER TABLE page_versions ADD COLUMN IF NOT EXISTS brain_id UUID;
      END IF;
    END $$;
  `);

  await ensureTable("idx_page_versions", `
    CREATE INDEX IF NOT EXISTS idx_page_versions ON page_versions(brain_id, page_slug, created_at DESC)
  `);

  await ensureTable("activities", `
    CREATE TABLE IF NOT EXISTS activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brain_id UUID NOT NULL,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_slug TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await ensureTable("idx_activities", `
    CREATE INDEX IF NOT EXISTS idx_activities ON activities(brain_id, created_at DESC)
  `);

  await ensureTable("applications", `
    CREATE TABLE IF NOT EXISTS applications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      team_size TEXT,
      message TEXT,
      source TEXT DEFAULT 'landing_page',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  console.log("[brainbase] Collaboration schema ensured");
}

/**
 * Ensure just the applications table exists (for /apply and /admin routes).
 */
export async function ensureApplicationsTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        company TEXT,
        team_size TEXT,
        message TEXT,
        source TEXT DEFAULT 'landing_page',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error("[brainbase] Failed to ensure applications table:", err);
    throw err;
  }
}

/**
 * v0.4 — Minions job queue schema (Phase 2: GBrain parity).
 *
 * Postgres-native job queue — no Redis, no BullMQ dependency.
 * Inspired by GBrain's `minion_jobs` table but adapted for serverless
 * Vercel deployment where the "worker" is a cron-driven batch tick,
 * not a long-running polling loop.
 */
export async function ensureMinionsSchema(): Promise<void> {
  try {
    // --- Core jobs table ---
    await query(`
      CREATE TABLE IF NOT EXISTS minion_jobs (
        id              BIGSERIAL PRIMARY KEY,
        name            TEXT NOT NULL,
        queue           TEXT NOT NULL DEFAULT 'default',
        status          TEXT NOT NULL DEFAULT 'waiting',
        priority        INTEGER NOT NULL DEFAULT 0,
        data            JSONB NOT NULL DEFAULT '{}',
        brain_id        UUID,

        -- Retry
        max_attempts    INTEGER NOT NULL DEFAULT 3,
        attempts_made   INTEGER NOT NULL DEFAULT 0,

        -- Lock / claim (serverless-safe: lock expires on its own)
        lock_token      TEXT,
        lock_until      TIMESTAMPTZ,
        max_stalled     INTEGER NOT NULL DEFAULT 3,
        stalled_counter INTEGER NOT NULL DEFAULT 0,

        -- Scheduling
        delay_until     TIMESTAMPTZ,

        -- Timeout
        timeout_ms      INTEGER,
        timeout_at      TIMESTAMPTZ,

        -- Dependencies (simplified: parent/child for subagent support)
        parent_job_id   BIGINT REFERENCES minion_jobs(id) ON DELETE SET NULL,
        on_child_fail   TEXT NOT NULL DEFAULT 'fail_parent',
        depth           INTEGER NOT NULL DEFAULT 0,
        max_children    INTEGER,

        -- Idempotency
        idempotency_key TEXT UNIQUE,

        -- Results
        result          JSONB,
        progress        JSONB,
        error_text      TEXT,
        stacktrace      TEXT[] DEFAULT '{}',

        -- Timestamps
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at      TIMESTAMPTZ,
        finished_at     TIMESTAMPTZ,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // --- Idempotent column additions (for existing tables from earlier deploys) ---
    await query(`ALTER TABLE minion_jobs DROP CONSTRAINT IF EXISTS chk_attempts_order`);
    await query(`ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS brain_id UUID`);
    await query(`ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS timeout_ms INTEGER`);
    await query(`ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMPTZ`);
    await query(`ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS depth INTEGER NOT NULL DEFAULT 0`);
    await query(`ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS max_children INTEGER`);
    await query(`ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS parent_job_id BIGINT`);
    await query(`ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS on_child_fail TEXT NOT NULL DEFAULT 'fail_parent'`);
    await query(`ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS idempotency_key TEXT`);
    await query(`ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS progress JSONB`);
    await query(`ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS stacktrace TEXT[] DEFAULT '{}'`);
    await query(`ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS max_stalled INTEGER NOT NULL DEFAULT 3`);
    await query(`ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS stalled_counter INTEGER NOT NULL DEFAULT 0`);

    // --- Inbox for side-channel messages (child_done notifications etc.) ---
    await query(`
      CREATE TABLE IF NOT EXISTS minion_inbox (
        id        BIGSERIAL PRIMARY KEY,
        job_id    BIGINT NOT NULL REFERENCES minion_jobs(id) ON DELETE CASCADE,
        sender    TEXT NOT NULL DEFAULT 'system',
        payload   JSONB NOT NULL DEFAULT '{}',
        read_at   TIMESTAMPTZ,
        sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // --- Indexes ---
    // Claim query: status='waiting' AND delay_until IS NULL, ordered by priority+created_at
    await query(`
      CREATE INDEX IF NOT EXISTS idx_minion_jobs_claim
        ON minion_jobs (queue, status, priority, created_at)
        WHERE status = 'waiting' AND delay_until IS NULL
    `);

    // Stall detection: status='active' with expired lock
    await query(`
      CREATE INDEX IF NOT EXISTS idx_minion_jobs_stalled
        ON minion_jobs (lock_until)
        WHERE status = 'active'
    `);

    // List by status
    await query(`
      CREATE INDEX IF NOT EXISTS idx_minion_jobs_status
        ON minion_jobs (status, created_at DESC)
    `);

    // Idempotency lookups
    await query(`
      CREATE INDEX IF NOT EXISTS idx_minion_jobs_idempotency
        ON minion_jobs (idempotency_key)
        WHERE idempotency_key IS NOT NULL
    `);

    // Parent/child queries
    await query(`
      CREATE INDEX IF NOT EXISTS idx_minion_jobs_parent
        ON minion_jobs (parent_job_id)
        WHERE parent_job_id IS NOT NULL
    `);

    // Inbox lookups
    await query(`
      CREATE INDEX IF NOT EXISTS idx_minion_inbox_unread
        ON minion_inbox (job_id, read_at)
        WHERE read_at IS NULL
    `);

    // Brain-scoped listing
    await query(`
      CREATE INDEX IF NOT EXISTS idx_minion_jobs_brain
        ON minion_jobs (brain_id, created_at DESC)
        WHERE brain_id IS NOT NULL
    `);

    console.log("[brainbase] Minions schema ensured");
  } catch (err) {
    console.error("[brainbase] Minions schema error:", err);
  }
}

/**
 * Install database triggers that auto-populate brain_id on INSERT
 * when it's NULL. This is a safety net for external tools (like gbrain
 * CLI) that haven't been updated to include brain_id in their queries.
 */
/**
 * v0.25 — Dream cycle schema: dream_verdicts cache for transcript significance.
 */
export async function ensureDreamSchema(): Promise<void> {
  const ensureTable = async (label: string, sql: string) => {
    try {
      await query(sql);
    } catch (err) {
      console.error(`[brainbase] Dream schema ensure failed for ${label}:`, err);
    }
  };

  await ensureTable("dream_verdicts", `
    CREATE TABLE IF NOT EXISTS dream_verdicts (
      file_path     TEXT NOT NULL,
      content_hash  TEXT NOT NULL,
      verdict       TEXT NOT NULL,
      brain_id      UUID,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (file_path, content_hash)
    )
  `);

  await ensureTable("idx_dream_verdicts_brain", `
    CREATE INDEX IF NOT EXISTS idx_dream_verdicts_brain
      ON dream_verdicts (brain_id, created_at DESC)
      WHERE brain_id IS NOT NULL
  `);

  console.log("[brainbase] Dream schema ensured");
}

/**
 * v0.5 — Raw Data Storage: provenance for enriched data.
 * Stores raw API responses keyed by (brain_id, page_slug, source).
 */
export async function ensureRawDataSchema(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS brain_raw_data (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brain_id    UUID NOT NULL,
        page_slug   TEXT NOT NULL,
        source      TEXT NOT NULL,
        data        JSONB NOT NULL,
        fetched_at  TIMESTAMPTZ DEFAULT NOW(),
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(brain_id, page_slug, source)
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_raw_data_brain_page
        ON brain_raw_data (brain_id, page_slug)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_raw_data_source
        ON brain_raw_data (brain_id, source)
    `);

    console.log("[brainbase] Raw data schema ensured");
  } catch (err) {
    console.error("[brainbase] Raw data schema error:", err);
  }
}

/**
 * v0.6 — Webhooks: per-brain subscriptions to brain events.
 * Idempotent. Safe to call repeatedly.
 */
export async function ensureWebhooksSchema(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brain_id UUID NOT NULL,
        url TEXT NOT NULL,
        secret TEXT NOT NULL,
        events TEXT[] NOT NULL DEFAULT '{}',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        description TEXT,
        last_delivery_at TIMESTAMPTZ,
        last_delivery_status INTEGER,
        last_delivery_error TEXT,
        delivery_count BIGINT NOT NULL DEFAULT 0,
        failure_count BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_webhooks_brain ON webhooks(brain_id) WHERE enabled = TRUE`);
  } catch (err) {
    console.error("[brainbase] Webhooks schema error:", err);
  }
}

/**
 * v0.6 — Public wiki: per-page public flag and brain-level wiki toggle.
 * Idempotent. Safe to call repeatedly.
 */
export async function ensureWikiSchema(): Promise<void> {
  try {
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pages') THEN
          ALTER TABLE pages ADD COLUMN IF NOT EXISTS public BOOLEAN NOT NULL DEFAULT FALSE;
        END IF;
      END $$;
    `);
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brains') THEN
          ALTER TABLE brains ADD COLUMN IF NOT EXISTS wiki_enabled BOOLEAN NOT NULL DEFAULT FALSE;
          ALTER TABLE brains ADD COLUMN IF NOT EXISTS wiki_title TEXT;
          ALTER TABLE brains ADD COLUMN IF NOT EXISTS wiki_tagline TEXT;
        END IF;
      END $$;
    `);
    // Filtered index: only pages flagged public, fastest path for the wiki list query
    await query(`
      CREATE INDEX IF NOT EXISTS idx_pages_public_brain
        ON pages(brain_id, slug) WHERE public = TRUE
    `);
  } catch (err) {
    console.error("[brainbase] Wiki schema error:", err);
  }
}

/**
 * v0.5 — Tag Management: adds a TEXT[] tags column to pages.
 * Uses Postgres array type for efficient storage and querying.
 */
export async function ensureTagsColumn(): Promise<void> {
  try {
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pages') THEN
          ALTER TABLE pages ADD COLUMN IF NOT EXISTS tags TEXT[];
        END IF;
      END $$;
    `);

    // GIN index for efficient array containment queries (find pages by tag)
    await query(`
      CREATE INDEX IF NOT EXISTS idx_pages_tags
        ON pages USING GIN (tags)
    `);

    console.log("[brainbase] Tags column ensured");
  } catch (err) {
    console.error("[brainbase] Tags column error:", err);
  }
}

export async function installBrainIdTriggers(): Promise<void> {
  try {
    const legacyBrainId = '00000000-0000-0000-0000-000000000001';

    await query(`
      CREATE OR REPLACE FUNCTION set_default_brain_id()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.brain_id IS NULL THEN
          NEW.brain_id := '${legacyBrainId}'::uuid;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    for (const table of ['pages', 'links', 'content_chunks', 'timeline_entries']) {
      await query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${table}') THEN
            IF NOT EXISTS (
              SELECT 1 FROM pg_trigger
              WHERE tgname = 'trg_${table}_default_brain_id'
            ) THEN
              CREATE TRIGGER trg_${table}_default_brain_id
                BEFORE INSERT ON ${table}
                FOR EACH ROW
                EXECUTE FUNCTION set_default_brain_id();
            END IF;
          END IF;
        END $$;
      `);
    }

    console.log("[brainbase] brain_id triggers installed");
  } catch (err) {
    console.error("[brainbase] Trigger install error:", err);
  }
}
