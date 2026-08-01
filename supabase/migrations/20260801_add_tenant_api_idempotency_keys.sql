-- Add tenant_id to api_idempotency_keys with safe backfill, FK, indexes, RLS
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='api_idempotency_keys' AND column_name='tenant_id') THEN
    ALTER TABLE public.api_idempotency_keys ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to api_idempotency_keys';
  END IF;
END$$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='api_idempotency_keys' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.api_idempotency_keys t SET tenant_id = c.tenant_id FROM public.companies c WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill api_idempotency_keys skipped: %', SQLERRM;
    END;
  END IF;
END$$;
DO $$
BEGIN
  IF (SELECT count(1) FROM public.api_idempotency_keys WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.api_idempotency_keys ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on api_idempotency_keys: %', SQLERRM;
    END;
  END IF;
END$$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_name='api_idempotency_keys' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      ALTER TABLE public.api_idempotency_keys ADD CONSTRAINT fk_api_idempotency_keys_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_api_idempotency_keys_tenant ON public.api_idempotency_keys (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_api_idempotency_keys_tenant_company ON public.api_idempotency_keys (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.api_idempotency_keys';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.api_idempotency_keys';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.api_idempotency_keys AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.api_idempotency_keys FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.api_idempotency_keys.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.api_idempotency_keys FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;
COMMIT;