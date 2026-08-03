-- Add tenant_id to ast_categories with safe backfill, FK, indexes, RLS
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ast_categories' AND column_name='tenant_id') THEN
    ALTER TABLE public.ast_categories ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to ast_categories';
  END IF;
END$$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ast_categories' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.ast_categories t SET tenant_id = c.tenant_id FROM public.companies c WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill ast_categories skipped: %', SQLERRM;
    END;
  END IF;
END$$;
DO $$
BEGIN
  IF (SELECT count(1) FROM public.ast_categories WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.ast_categories ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on ast_categories: %', SQLERRM;
    END;
  END IF;
END$$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='ast_categories' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.ast_categories ADD CONSTRAINT fk_ast_categories_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ast_categories_tenant ON public.ast_categories (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ast_categories_tenant_company ON public.ast_categories (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.ast_categories ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.ast_categories';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.ast_categories';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.ast_categories AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.ast_categories FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.ast_categories.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.ast_categories FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;
COMMIT;