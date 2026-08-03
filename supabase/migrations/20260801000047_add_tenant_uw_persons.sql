-- Add tenant_id to uw_persons (base table for uw_person_360 view) with safe backfill, FK, indexes, RLS
BEGIN;

-- 1. Add tenant_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='uw_persons' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.uw_persons ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to uw_persons';
  ELSE
    RAISE NOTICE 'tenant_id already exists on uw_persons';
  END IF;
END$$;

-- 2. Backfill tenant_id from companies using company_id (safe guarded)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='uw_persons' AND column_name='company_id') THEN
    BEGIN
      UPDATE public.uw_persons t
      SET tenant_id = c.tenant_id
      FROM public.companies c
      WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
      RAISE NOTICE 'Backfilled tenant_id on uw_persons from companies';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill skipped for uw_persons due to: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'uw_persons has no company_id; manual review required';
  END IF;
END$$;

-- 3. Attempt to set NOT NULL if no nulls remain
DO $$
DECLARE cnt int;
BEGIN
  SELECT count(1) INTO cnt FROM public.uw_persons WHERE tenant_id IS NULL;
  IF cnt = 0 THEN
    BEGIN
      ALTER TABLE public.uw_persons ALTER COLUMN tenant_id SET NOT NULL;
      RAISE NOTICE 'Set tenant_id NOT NULL on uw_persons';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on uw_persons: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'tenant_id has % NULL rows on uw_persons; leaving nullable', cnt;
  END IF;
END$$;

-- 4. Add FK to tenants if tenants table exists and FK not present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
      WHERE tc.table_name='uw_persons' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
    ) THEN
      ALTER TABLE public.uw_persons ADD CONSTRAINT fk_uw_persons_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      RAISE NOTICE 'Added FK tenant->tenants for uw_persons';
    ELSE
      RAISE NOTICE 'FK on tenant_id already exists for uw_persons';
    END IF;
  ELSE
    RAISE NOTICE 'tenants table missing; skipping FK for uw_persons';
  END IF;
END$$;

-- 5. Create indexes
DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_uw_persons_tenant ON public.uw_persons (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_uw_persons_tenant_company ON public.uw_persons (tenant_id, company_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_uw_persons_tenant_created_at ON public.uw_persons (tenant_id, created_at)';
  RAISE NOTICE 'Ensured indexes on uw_persons';
END$$;

-- 6. Enable RLS and add tenant-aware restrictive policy
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.uw_persons ENABLE ROW LEVEL SECURITY';
  -- Drop legacy policies
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.uw_persons';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.uw_persons';
  -- Create restrictive policy using tenant_company_access helper if available
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.uw_persons AS RESTRICTIVE FOR ALL USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
    RAISE NOTICE 'Created tenant_company_access-based policy on uw_persons';
  ELSE
    -- Fallback: require tenant match and membership existence
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.uw_persons FOR SELECT USING (
      tenant_id = public.current_user_tenant() AND EXISTS (
        SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.uw_persons.company_id AND m.user_id = auth.uid() AND m.status = 'active'
      )
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.uw_persons FOR ALL USING (tenant_id = public.current_user_tenant()) WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
    RAISE NOTICE 'Created fallback tenant-aware policies on uw_persons';
  END IF;
END$$;

COMMIT;
