-- Add tenant_id to prt_queue with safe backfill, FK, indexes, RLS
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='prt_queue' AND column_name='tenant_id') THEN
    ALTER TABLE public.prt_queue ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to prt_queue';
  END IF;
END$$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='prt_queue' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.prt_queue t SET tenant_id = c.tenant_id FROM public.companies c WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill prt_queue skipped: %', SQLERRM;
    END;
  END IF;
END$$;
DO $$
BEGIN
  IF (SELECT count(1) FROM public.prt_queue WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.prt_queue ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on prt_queue: %', SQLERRM;
    END;
  END IF;
END$$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='prt_queue' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.prt_queue ADD CONSTRAINT fk_prt_queue_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_prt_queue_tenant ON public.prt_queue (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_prt_queue_tenant_company ON public.prt_queue (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.prt_queue ENABLE ROW LEVEL SECURITY';
  -- Create policies only if they do not already exist to avoid DDL contention/deadlocks
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE p.polname = 'tenant_isolation_restrict' AND n.nspname = 'public' AND c.relname = 'prt_queue'
    ) THEN
      EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.prt_queue AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE p.polname = 'tenant_isolation_select' AND n.nspname = 'public' AND c.relname = 'prt_queue'
    ) THEN
      EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.prt_queue FOR SELECT USING (
        tenant_id = public.current_user_tenant() AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.prt_queue.company_id AND m.user_id = auth.uid() AND m.status = 'active')
      )$sql$;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE p.polname = 'tenant_isolation_write' AND n.nspname = 'public' AND c.relname = 'prt_queue'
    ) THEN
      EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.prt_queue FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
    END IF;
  END IF;
END$$;
COMMIT;