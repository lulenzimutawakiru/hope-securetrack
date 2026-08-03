-- Audit public base tables that have company_id and tenant_id presence/nullable
SELECT t.table_name,
       MAX(CASE WHEN c.column_name='company_id' THEN 1 ELSE 0 END) AS has_company,
       MAX(CASE WHEN c.column_name='tenant_id' THEN 1 ELSE 0 END) AS has_tenant,
       MAX(CASE WHEN c.column_name='tenant_id' THEN c.is_nullable ELSE NULL END) AS tenant_is_nullable
FROM information_schema.columns c
JOIN information_schema.tables t ON c.table_schema = t.table_schema AND c.table_name = t.table_name
WHERE t.table_schema='public' AND t.table_type='BASE TABLE' AND c.column_name IN ('company_id','tenant_id')
GROUP BY t.table_name
HAVING MAX(CASE WHEN c.column_name='company_id' THEN 1 ELSE 0 END) = 1
ORDER BY t.table_name;