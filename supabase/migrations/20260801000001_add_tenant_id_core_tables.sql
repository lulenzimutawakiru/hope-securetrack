-- Migration: Add tenant_id, backfill, FK, indexes, and enable RLS with tenant-aware policies
-- Idempotent: safe to run multiple times
-- Applies to core company-scoped tables defined in rls-matrix

DO $$
DECLARE
  tbl text;
  null_exists int;
  has_company_col boolean;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'employees','payroll_runs','pay_employee_profiles','invoices','sales_orders','qr_codes','eal_events',
    'bill_portal_users','att_devices','ta_vacancies','fleet_vehicles','gl_journals','user_company_memberships',
    'domain_events','sec_dual_control_requests','wf_instances','job_queue','srm_match_logs','pay_payment_batches','fin_auto_journals'
  ])
  LOOP
    -- 1. Add tenant_id column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id uuid', tbl);
      RAISE NOTICE 'Added tenant_id to %', tbl;
    ELSE
      RAISE NOTICE 'tenant_id already exists on %', tbl;
    END IF;

    -- 2. Backfill tenant_id when company_id exists and companies table contains tenant_id
    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns WHERE table_name = tbl AND column_name = 'company_id'
    ) INTO has_company_col;

    IF has_company_col THEN
      BEGIN
        EXECUTE format(
          'UPDATE public.%1$I t SET tenant_id = c.tenant_id FROM public.companies c WHERE t.company_id = c.id AND t.tenant_id IS NULL', tbl
        );
        RAISE NOTICE 'Backfilled tenant_id for % where company_id present', tbl;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Backfill skipped for % due to: %', tbl, SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'No company_id on %; skipping backfill', tbl;
    END IF;

    -- 3. If no NULL tenant_id remain, set NOT NULL
    EXECUTE format('SELECT 1 FROM public.%I WHERE tenant_id IS NULL LIMIT 1', tbl) INTO null_exists;
    IF null_exists IS NULL THEN
      BEGIN
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', tbl);
        RAISE NOTICE 'Set tenant_id NOT NULL on %', tbl;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not set NOT NULL on % (may have triggers or concurrent transactions): %', tbl, SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'tenant_id still has NULLs on %; leaving nullable', tbl;
    END IF;

    -- 4. Add FK to tenants if tenants table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu USING (constraint_name, table_catalog, table_schema)
        WHERE tc.table_name = tbl AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
      ) THEN
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT fk_%I_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT', tbl, tbl);
        RAISE NOTICE 'Added FK tenant -> tenants for %', tbl;
      ELSE
        RAISE NOTICE 'FK on tenant_id already exists for %', tbl;
      END IF;
    ELSE
      RAISE NOTICE 'tenants table missing; skipping FK for %', tbl;
    END IF;

    -- 5. Create indexes: tenant_id and composites
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant ON public.%I (tenant_id)', tbl, tbl);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant_company ON public.%I (tenant_id, company_id)', tbl, tbl);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant_created_at ON public.%I (tenant_id, created_at)', tbl, tbl);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant_status ON public.%I (tenant_id, status)', tbl, tbl);
      RAISE NOTICE 'Ensured indexes for %', tbl;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Index creation skipped/failed for %: %', tbl, SQLERRM;
    END;

    -- 6. Enable RLS and create strict policies enforcing tenant + membership
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      RAISE NOTICE 'Enabled RLS on %', tbl;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'RLS enable error on %: %', tbl, SQLERRM;
    END;

    -- Drop any existing policy we will replace
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_write ON public.%I', tbl);

    -- Special-case user_company_memberships to avoid recursive policies that select from the same table
    IF tbl = 'user_company_memberships' THEN
      EXECUTE format('DROP POLICY IF EXISTS ucm_select ON public.%I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS ucm_manage ON public.%I', tbl);
      -- Ensure RLS enabled
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      -- Minimal, non-recursive policies: users can read/manage their own memberships; platform admins can manage all
      EXECUTE format('CREATE POLICY ucm_select ON public.%I FOR SELECT USING (user_id = auth.uid() OR public.is_platform_admin())', tbl);
      EXECUTE format('CREATE POLICY ucm_manage ON public.%I FOR ALL USING (user_id = auth.uid() OR public.is_platform_admin()) WITH CHECK (user_id = auth.uid() OR public.is_platform_admin())', tbl);
      RAISE NOTICE 'Created non-recursive policies for %', tbl;
    ELSE
      -- Create SELECT policy
      EXECUTE format($sql$
        CREATE POLICY tenant_isolation_select ON public.%I FOR SELECT USING (
          tenant_id = public.current_user_tenant()
          AND (
            -- membership guard: user must have active membership for the company
            EXISTS (
              SELECT 1 FROM public.user_company_memberships m
              WHERE m.company_id = public.%I.company_id
                AND m.user_id = auth.uid()
                AND m.status = 'active'
            )
          )
        )
      $sql$, tbl, tbl);

      -- Create INSERT/UPDATE/DELETE policy with WITH CHECK to ensure write maintains ownership
      EXECUTE format($sql$
        CREATE POLICY tenant_isolation_write ON public.%I FOR ALL USING (
          tenant_id = public.current_user_tenant()
          AND EXISTS (
            SELECT 1 FROM public.user_company_memberships m
            WHERE m.company_id = public.%I.company_id
              AND m.user_id = auth.uid()
              AND m.status = 'active'
          )
        ) WITH CHECK (
          tenant_id = public.current_user_tenant()
          AND EXISTS (
            SELECT 1 FROM public.user_company_memberships m
            WHERE m.company_id = public.%I.company_id
              AND m.user_id = auth.uid()
              AND m.status = 'active'
          )
        )
      $sql$, tbl, tbl, tbl);

      RAISE NOTICE 'Created RLS policies for %', tbl;
    END IF;

  END LOOP;
END $$;

-- End migration
