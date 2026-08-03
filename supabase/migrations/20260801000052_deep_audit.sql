-- Deep audit: metadata for tables with company_id and nullable/missing tenant_id
WITH cols AS (
  SELECT table_name,
         MAX(CASE WHEN column_name='company_id' THEN 1 ELSE 0 END) AS has_company,
         MAX(CASE WHEN column_name='tenant_id' THEN 1 ELSE 0 END) AS has_tenant,
         MAX(CASE WHEN column_name='tenant_id' THEN is_nullable ELSE NULL END) AS tenant_is_nullable,
         MAX(CASE WHEN column_name='created_at' THEN 1 ELSE 0 END) AS has_created_at
  FROM information_schema.columns
  WHERE table_schema='public' AND column_name IN ('company_id','tenant_id','created_at')
  GROUP BY table_name
)
SELECT c.table_name,
       c.has_company,
       c.has_tenant,
       c.tenant_is_nullable,
       c.has_created_at,
       COALESCE((SELECT pc.reltuples::bigint FROM pg_class pc JOIN pg_namespace pn ON pc.relnamespace=pn.oid WHERE pn.nspname='public' AND pc.relname = c.table_name), 0) AS row_estimate,
       (SELECT count(1) FROM pg_indexes pi WHERE pi.schemaname='public' AND pi.tablename = c.table_name AND pi.indexdef ILIKE '%(tenant_id%') AS tenant_index_count,
       (SELECT count(1) FROM pg_trigger trg JOIN pg_class cl ON trg.tgrelid = cl.oid JOIN pg_namespace ns ON cl.relnamespace = ns.oid WHERE ns.nspname='public' AND cl.relname = c.table_name) AS triggers_count,
       EXISTS (SELECT 1 FROM information_schema.views v WHERE v.table_schema='public' AND v.table_name = c.table_name) AS is_view
FROM cols c
WHERE c.has_company = 1 AND (c.has_tenant = 0 OR c.tenant_is_nullable = 'YES')
ORDER BY row_estimate DESC NULLS LAST;
