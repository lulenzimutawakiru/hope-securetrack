-- Quick audit: schema-level checks
SELECT 'tables_missing_tenant_id' as section;
SELECT table_name FROM information_schema.tables t
WHERE t.table_schema='public' AND t.table_type='BASE TABLE'
  AND t.table_name NOT LIKE 'pg_%' AND t.table_name NOT IN ('spatial_ref_sys')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=t.table_name AND c.column_name='tenant_id'
  )
ORDER BY table_name;

SELECT 'tables_with_company_but_no_tenant' as section;
SELECT DISTINCT c.table_name FROM information_schema.columns c
WHERE c.table_schema='public' AND c.column_name='company_id'
  AND c.table_name NOT IN (
    SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenant_id'
  )
ORDER BY c.table_name;

SELECT 'tables_with_tenant_nullable' as section;
SELECT table_name FROM information_schema.columns
WHERE table_schema='public' AND column_name='tenant_id' AND is_nullable='YES'
ORDER BY table_name;

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
