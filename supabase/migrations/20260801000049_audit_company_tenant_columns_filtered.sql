-- Filtered audit: tables with company_id and either missing tenant_id or tenant_id nullable
WITH t AS (
  SELECT t.table_name,
         MAX(CASE WHEN c.column_name='company_id' THEN 1 ELSE 0 END) AS has_company,
         MAX(CASE WHEN c.column_name='tenant_id' THEN 1 ELSE 0 END) AS has_tenant,
         MAX(CASE WHEN c.column_name='tenant_id' THEN c.is_nullable ELSE NULL END) AS tenant_is_nullable
  FROM information_schema.columns c
  JOIN information_schema.tables t ON c.table_schema = t.table_schema AND c.table_name = t.table_name
  WHERE t.table_schema='public' AND t.table_type='BASE TABLE' AND c.column_name IN ('company_id','tenant_id')
  GROUP BY t.table_name
)
SELECT table_name,
       CASE
         WHEN has_tenant = 0 THEN 'MISSING_TENANT'
         WHEN tenant_is_nullable = 'YES' THEN 'TENANT_NULLABLE'
         ELSE 'OK'
       END AS status
FROM t
WHERE has_company = 1 AND (has_tenant = 0 OR tenant_is_nullable = 'YES')
ORDER BY status, table_name;