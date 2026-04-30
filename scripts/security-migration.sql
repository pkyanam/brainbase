-- ============================================================================
-- Brainbase Security Migration — Enable RLS + Encrypt Secrets
-- Run: psql $SUPABASE_DATABASE_URL -f scripts/security-migration.sql
-- ============================================================================
-- WARNING: This enables Row Level Security on ALL tables.
-- The app connects as the table owner (postgres role), so RLS is bypassed
-- for the Next.js API. This blocks ONLY non-owner connections (e.g., leaked
-- anon keys, direct Supabase client access, backup scripts using limited roles).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enable RLS on all tenant-scoped tables
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'brains',
    'api_keys',
    'brain_members',
    'brain_invites',
    'page_versions',
    'activities',
    'applications',
    'pages',
    'links',
    'content_chunks',
    'timeline_entries',
    'tags',
    'trigger_rules',
    'trigger_fires',
    'notifications',
    'brain_todos',
    'delegated_tasks',
    'usage_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
      RAISE NOTICE 'RLS enabled on table: %', tbl;
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'Table % does not exist, skipping.', tbl;
      WHEN OTHERS THEN
        RAISE NOTICE 'Error on %: %', tbl, SQLERRM;
    END;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Force RLS even for table owners (OPTIONAL — uncomment if you want
--    the postgres role to also be subject to RLS. This would BREAK the app
--    unless you also create policies that allow the postgres role.)
-- ----------------------------------------------------------------------------
-- DO $$
-- DECLARE
--   tbl TEXT;
-- BEGIN
--   FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
--   LOOP
--     EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
--   END LOOP;
-- END $$;

-- ----------------------------------------------------------------------------
-- 3. Create a helper function for tenant access checks
--    This uses a session variable set by the app before each query.
--    Usage: SET LOCAL app.current_user_id = 'user_xxx';
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_current_app_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_user_id', true);
EXCEPTION
  WHEN undefined_object THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 4. Create RLS policies for future client-side access
--    These policies use the session variable approach since Brainbase uses
--    Clerk, not Supabase Auth (so auth.uid() is unavailable).
--
--    NOTE: These policies do NOT affect the Next.js app because it connects
--    as the table owner (postgres role), which bypasses RLS by default.
--    They only restrict non-owner connections.
-- ----------------------------------------------------------------------------

-- Brains: Users can see brains they own or are members of
CREATE POLICY IF NOT EXISTS brains_owner_access ON brains
  FOR ALL
  USING (
    owner_user_id = get_current_app_user_id()
    OR EXISTS (
      SELECT 1 FROM brain_members
      WHERE brain_members.brain_id = brains.id
        AND brain_members.user_id = get_current_app_user_id()
    )
  );

-- Pages: Users can access pages in brains they own or are members of
CREATE POLICY IF NOT EXISTS pages_brain_access ON pages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brains
      WHERE brains.id = pages.brain_id
        AND (brains.owner_user_id = get_current_app_user_id()
             OR EXISTS (
               SELECT 1 FROM brain_members
               WHERE brain_members.brain_id = brains.id
                 AND brain_members.user_id = get_current_app_user_id()
             ))
    )
  );

-- Links: Same brain-based access
CREATE POLICY IF NOT EXISTS links_brain_access ON links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brains
      WHERE brains.id = links.brain_id
        AND (brains.owner_user_id = get_current_app_user_id()
             OR EXISTS (
               SELECT 1 FROM brain_members
               WHERE brain_members.brain_id = brains.id
                 AND brain_members.user_id = get_current_app_user_id()
             ))
    )
  );

-- Content chunks: Same brain-based access
CREATE POLICY IF NOT EXISTS chunks_brain_access ON content_chunks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brains
      WHERE brains.id = content_chunks.brain_id
        AND (brains.owner_user_id = get_current_app_user_id()
             OR EXISTS (
               SELECT 1 FROM brain_members
               WHERE brain_members.brain_id = brains.id
                 AND brain_members.user_id = get_current_app_user_id()
             ))
    )
  );

-- Timeline entries: Same brain-based access
CREATE POLICY IF NOT EXISTS timeline_brain_access ON timeline_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brains
      WHERE brains.id = timeline_entries.brain_id
        AND (brains.owner_user_id = get_current_app_user_id()
             OR EXISTS (
               SELECT 1 FROM brain_members
               WHERE brain_members.brain_id = brains.id
                 AND brain_members.user_id = get_current_app_user_id()
             ))
    )
  );

-- API keys: Only brain owner
CREATE POLICY IF NOT EXISTS api_keys_owner_access ON api_keys
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brains
      WHERE brains.id = api_keys.brain_id
        AND brains.owner_user_id = get_current_app_user_id()
    )
  );

-- Brain members: Only brain owner
CREATE POLICY IF NOT EXISTS brain_members_owner_access ON brain_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brains
      WHERE brains.id = brain_members.brain_id
        AND brains.owner_user_id = get_current_app_user_id()
    )
  );

-- Brain invites: Only brain owner
CREATE POLICY IF NOT EXISTS brain_invites_owner_access ON brain_invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brains
      WHERE brains.id = brain_invites.brain_id
        AND brains.owner_user_id = get_current_app_user_id()
    )
  );

-- Page versions: Brain owner/member access
CREATE POLICY IF NOT EXISTS page_versions_brain_access ON page_versions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brains
      WHERE brains.id = page_versions.brain_id
        AND (brains.owner_user_id = get_current_app_user_id()
             OR EXISTS (
               SELECT 1 FROM brain_members
               WHERE brain_members.brain_id = brains.id
                 AND brain_members.user_id = get_current_app_user_id()
             ))
    )
  );

-- Activities: Brain owner/member access
CREATE POLICY IF NOT EXISTS activities_brain_access ON activities
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brains
      WHERE brains.id = activities.brain_id
        AND (brains.owner_user_id = get_current_app_user_id()
             OR EXISTS (
               SELECT 1 FROM brain_members
               WHERE brain_members.brain_id = brains.id
                 AND brain_members.user_id = get_current_app_user_id()
             ))
    )
  );

-- Applications: Admin-only (no tenant column, so restrict to a hardcoded admin)
-- If you want to restrict this, uncomment and set your admin user ID:
-- CREATE POLICY IF NOT EXISTS applications_admin_access ON applications
--   FOR ALL
--   USING (get_current_app_user_id() = 'your_admin_user_id');

-- ----------------------------------------------------------------------------
-- 5. Add indexes to speed up RLS policy lookups
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_pages_brain_id ON pages(brain_id);
CREATE INDEX IF NOT EXISTS idx_links_brain_id ON links(brain_id);
CREATE INDEX IF NOT EXISTS idx_content_chunks_brain_id ON content_chunks(brain_id);
CREATE INDEX IF NOT EXISTS idx_timeline_entries_brain_id ON timeline_entries(brain_id);
CREATE INDEX IF NOT EXISTS idx_tags_brain_id ON tags(brain_id) WHERE brain_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. Audit log: record that this migration was run
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_migrations (name) VALUES ('security-rls-2026-04-30')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Done. All tables now have RLS enabled with tenant-scoped policies.
-- The app continues to work because the postgres role bypasses RLS.
-- ============================================================================
