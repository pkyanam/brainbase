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

    console.log("[brainbase] Schema ensured (multi-tenant)");
  } catch (err) {
    console.error("[brainbase] Schema setup error:", err);
  }
}

/**
 * v0.3 — Collaboration schema: brain members, invites, page versions, activities
 */
export async function ensureCollaborationSchema(): Promise<void> {
  try {
    // Brain members — many-to-many users ↔ brains
    await query(`
      CREATE TABLE IF NOT EXISTS brain_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brain_id UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'editor',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(brain_id, user_id)
      )
    `);

    // Brain invites — pending email invitations (token_hash only, no plain text)
    await query(`
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

    // Page versions — snapshot history
    await query(`
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
    await query(`
      CREATE INDEX IF NOT EXISTS idx_page_versions ON page_versions(brain_id, page_slug, created_at DESC)
    `);

    // Activity log
    await query(`
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
    await query(`
      CREATE INDEX IF NOT EXISTS idx_activities ON activities(brain_id, created_at DESC)
    `);

    // Design partner applications
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

    console.log("[brainbase] Collaboration schema ensured");
  } catch (err) {
    console.error("[brainbase] Collaboration schema error:", err);
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
