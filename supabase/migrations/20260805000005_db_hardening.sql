-- ============================================================================
-- DB hardening: FORCE ROW LEVEL SECURITY on all RLS-enabled business tables
-- 2026-08-03
--
-- Supabase default roles (anon/authenticated) are always subject to RLS, but
-- table-owner connections can bypass policies unless FORCE RLS is set. This
-- migration applies FORCE ROW LEVEL SECURITY to every business table with RLS
-- enabled so no connection class can bypass tenant isolation.
--
-- Scope: tables in business schemas (public + non-infra schemas) that have
-- relrowsecurity = true. Supabase-managed schemas are skipped.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  r record;
  applied int := 0;
  skipped int := 0;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           c.relname AS table_name,
           quote_ident(n.nspname) || '.' || quote_ident(c.relname) AS qualified
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND c.relrowsecurity = true
      AND n.nspname NOT IN (
        'auth', 'storage', 'vault', 'extensions', 'graphql', 'supabase_functions',
        'supabase_migrations', 'realtime', 'net', 'cron', 'pgbouncer', '_analytics'
      )
      AND n.nspname NOT LIKE 'pg_%'
      AND n.nspname <> 'information_schema'
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', r.qualified);
      applied := applied + 1;
    EXCEPTION WHEN OTHERS THEN
      skipped := skipped + 1;
      RAISE NOTICE 'FORCE RLS skipped for %: %', r.qualified, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'DB hardening: FORCE RLS applied to % tables (% skipped)', applied, skipped;
END$$;

-- Explicit re-application for the TA tables hardened in migration 03
-- (idempotent; kept here so the invariant survives future re-runs/edits).
ALTER TABLE IF EXISTS public.ta_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ta_attachments FORCE ROW LEVEL SECURITY;

COMMIT;