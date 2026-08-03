-- Audit: Find tables missing tenant_id, company_id-only tables, nullable tenant_id, triggers, policies, and tenant_id without FK

-- Tables missing tenant_id
SELECT 'tables_missing_tenant_id' as section;
SELECT table_name FROM information_schema.tables t
WHERE t.table_schema='public'
  AND t.table_type='BASE TABLE'
  AND t.table_name NOT LIKE 'pg_%'
  AND t.table_name NOT IN ('spatial_ref_sys')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=t.table_name AND c.column_name='tenant_id'
  )
ORDER BY table_name;

-- Tables that have company_id but no tenant_id
SELECT 'tables_with_company_but_no_tenant' as section;
SELECT DISTINCT c.table_name FROM information_schema.columns c
WHERE c.table_schema='public' AND c.column_name='company_id'
  AND c.table_name NOT IN (
    SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenant_id'
  )
ORDER BY c.table_name;

-- Tables with tenant_id nullable
SELECT 'tables_with_tenant_nullable' as section;
SELECT table_name FROM information_schema.columns
WHERE table_schema='public' AND column_name='tenant_id' AND is_nullable='YES'
ORDER BY table_name;

-- Tables with triggers (non-internal)
SELECT 'tables_with_triggers' as section;
SELECT DISTINCT c.relname AS table_name, pg_get_triggerdef(t.oid) AS trigger_def
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid=c.oid
JOIN pg_namespace n ON c.relnamespace=n.oid
WHERE n.nspname='public' AND NOT t.tgisinternal
ORDER BY c.relname;

-- RLS policies on public schema
SELECT 'tables_with_policies' as section;
SELECT schemaname, tablename, policyname, permissive, roles
FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;

-- tenant_id present but no FK to tenants
SELECT 'tenant_id_without_fk' as section;
SELECT c.table_name
FROM information_schema.columns c
WHERE c.table_schema='public' AND c.column_name='tenant_id'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema='public' AND tc.constraint_type='FOREIGN KEY'
      AND kcu.column_name = 'tenant_id' AND kcu.table_name = c.table_name
  )
ORDER BY c.table_name;
