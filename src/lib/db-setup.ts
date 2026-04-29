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

    // Brain invites — pending email invitations
    await query(`
      CREATE TABLE IF NOT EXISTS brain_invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brain_id UUID NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
        inviter_user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
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

    console.log("[brainbase] Collaboration schema ensured");
  } catch (err) {
    console.error("[brainbase] Collaboration schema error:", err);
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
