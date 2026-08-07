-- =============================================================================
-- SecureTrack ERP: tenant-scope remaining legacy company-scoped tables
-- -----------------------------------------------------------------------------
-- Adds tenant_id to tables that already carry a company_id (and to the two
-- cross-company EC tables). Backfill is derived from companies.tenant_id.
--
-- * idm_employee_numbering_rules / idm_employee_numbers
-- * intg_slack_delivery_log / user_push_tokens
--     -> full restrictive pattern: FK tenants(id) ON DELETE RESTRICT, composite
--        index (tenant_id, company_id), restrictive tenant_isolation_restrict
--        policy via tenant_company_access (AND'd with existing policies).
-- * ec_intercompany_links / ec_shared_services
--     -> dual-company tables; tenant_id added for queue isolation + audits only
--        (BI precedent). RLS remains company-scoped by design.
--
-- NOT NULL is applied only when every row resolves to a tenant (the tenant-less
-- "SecureTrack ERP Operations" staff company keeps NULL tenant rows).
-- Idempotent; safe to re-run.
-- =============================================================================
BEGIN;
-- =============================================================================
-- idm_employee_numbering_rules  (company-scoped)
-- Add tenant_id, backfill from companies, enforce isolation.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='idm_employee_numbering_rules' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.idm_employee_numbering_rules ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to idm_employee_numbering_rules';
  END IF;
END$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.idm_employee_numbering_rules t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Backfill idm_employee_numbering_rules skipped: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  IF (SELECT count(1) FROM public.idm_employee_numbering_rules WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.idm_employee_numbering_rules ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on idm_employee_numbering_rules: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='public' AND tc.table_name='idm_employee_numbering_rules' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      BEGIN
        ALTER TABLE public.idm_employee_numbering_rules ADD CONSTRAINT fk_idm_employee_numbering_rules_tenant
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant FK on idm_employee_numbering_rules: %', SQLERRM;
      END;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_idm_employee_numbering_rules_tenant ON public.idm_employee_numbering_rules (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_idm_employee_numbering_rules_tenant_company ON public.idm_employee_numbering_rules (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.idm_employee_numbering_rules ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.idm_employee_numbering_rules';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.idm_employee_numbering_rules';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.idm_employee_numbering_rules';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.idm_employee_numbering_rules AS RESTRICTIVE FOR ALL
      USING (public.tenant_company_access(tenant_id, company_id))
      WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.idm_employee_numbering_rules FOR SELECT USING (
      tenant_id = public.current_user_tenant()
      AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.idm_employee_numbering_rules.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.idm_employee_numbering_rules FOR ALL
      USING (tenant_id = public.current_user_tenant())
      WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;
-- =============================================================================
-- idm_employee_numbers  (company-scoped)
-- Add tenant_id, backfill from companies, enforce isolation.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='idm_employee_numbers' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.idm_employee_numbers ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to idm_employee_numbers';
  END IF;
END$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.idm_employee_numbers t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Backfill idm_employee_numbers skipped: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  IF (SELECT count(1) FROM public.idm_employee_numbers WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.idm_employee_numbers ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on idm_employee_numbers: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='public' AND tc.table_name='idm_employee_numbers' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      BEGIN
        ALTER TABLE public.idm_employee_numbers ADD CONSTRAINT fk_idm_employee_numbers_tenant
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant FK on idm_employee_numbers: %', SQLERRM;
      END;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_idm_employee_numbers_tenant ON public.idm_employee_numbers (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_idm_employee_numbers_tenant_company ON public.idm_employee_numbers (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.idm_employee_numbers ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.idm_employee_numbers';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.idm_employee_numbers';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.idm_employee_numbers';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.idm_employee_numbers AS RESTRICTIVE FOR ALL
      USING (public.tenant_company_access(tenant_id, company_id))
      WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.idm_employee_numbers FOR SELECT USING (
      tenant_id = public.current_user_tenant()
      AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.idm_employee_numbers.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.idm_employee_numbers FOR ALL
      USING (tenant_id = public.current_user_tenant())
      WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;
-- =============================================================================
-- intg_slack_delivery_log  (company-scoped)
-- Add tenant_id, backfill from companies, enforce isolation.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='intg_slack_delivery_log' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.intg_slack_delivery_log ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to intg_slack_delivery_log';
  END IF;
END$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.intg_slack_delivery_log t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Backfill intg_slack_delivery_log skipped: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  IF (SELECT count(1) FROM public.intg_slack_delivery_log WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.intg_slack_delivery_log ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on intg_slack_delivery_log: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='public' AND tc.table_name='intg_slack_delivery_log' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      BEGIN
        ALTER TABLE public.intg_slack_delivery_log ADD CONSTRAINT fk_intg_slack_delivery_log_tenant
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant FK on intg_slack_delivery_log: %', SQLERRM;
      END;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_intg_slack_delivery_log_tenant ON public.intg_slack_delivery_log (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_intg_slack_delivery_log_tenant_company ON public.intg_slack_delivery_log (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.intg_slack_delivery_log ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.intg_slack_delivery_log';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.intg_slack_delivery_log';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.intg_slack_delivery_log';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.intg_slack_delivery_log AS RESTRICTIVE FOR ALL
      USING (public.tenant_company_access(tenant_id, company_id))
      WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.intg_slack_delivery_log FOR SELECT USING (
      tenant_id = public.current_user_tenant()
      AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.intg_slack_delivery_log.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.intg_slack_delivery_log FOR ALL
      USING (tenant_id = public.current_user_tenant())
      WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;
-- =============================================================================
-- user_push_tokens  (company-scoped)
-- Add tenant_id, backfill from companies, enforce isolation.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_push_tokens' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.user_push_tokens ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to user_push_tokens';
  END IF;
END$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.user_push_tokens t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Backfill user_push_tokens skipped: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  IF (SELECT count(1) FROM public.user_push_tokens WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.user_push_tokens ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on user_push_tokens: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='public' AND tc.table_name='user_push_tokens' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      BEGIN
        ALTER TABLE public.user_push_tokens ADD CONSTRAINT fk_user_push_tokens_tenant
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant FK on user_push_tokens: %', SQLERRM;
      END;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_push_tokens_tenant ON public.user_push_tokens (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_push_tokens_tenant_company ON public.user_push_tokens (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.user_push_tokens';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.user_push_tokens';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.user_push_tokens';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.user_push_tokens AS RESTRICTIVE FOR ALL
      USING (public.tenant_company_access(tenant_id, company_id))
      WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.user_push_tokens FOR SELECT USING (
      tenant_id = public.current_user_tenant()
      AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.user_push_tokens.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.user_push_tokens FOR ALL
      USING (tenant_id = public.current_user_tenant())
      WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;
-- =============================================================================
-- ec_intercompany_links  (cross-company, BI precedent)
-- Adds tenant_id for job-queue isolation, enforcement and cross-tenant audits.
-- RLS intentionally stays company-scoped (existing policies allow either the
-- from_company_id or the to_company_id company), so no restrictive policy is added.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ec_intercompany_links' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.ec_intercompany_links ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to ec_intercompany_links';
  END IF;
END$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.ec_intercompany_links t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE c.id = t.from_company_id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);

    UPDATE public.ec_intercompany_links t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE t.tenant_id IS NULL AND c.id = t.to_company_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Backfill ec_intercompany_links skipped: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  IF (SELECT count(1) FROM public.ec_intercompany_links WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.ec_intercompany_links ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on ec_intercompany_links: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='public' AND tc.table_name='ec_intercompany_links' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      BEGIN
        ALTER TABLE public.ec_intercompany_links ADD CONSTRAINT fk_ec_intercompany_links_tenant
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant FK on ec_intercompany_links: %', SQLERRM;
      END;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ec_intercompany_links_tenant ON public.ec_intercompany_links (tenant_id)';
  EXECUTE 'ALTER TABLE public.ec_intercompany_links ENABLE ROW LEVEL SECURITY';
END$$;
-- =============================================================================
-- ec_shared_services  (cross-company, BI precedent)
-- Adds tenant_id for job-queue isolation, enforcement and cross-tenant audits.
-- RLS intentionally stays company-scoped (existing policies allow either the
-- provider_company_id or the consumer_company_id company), so no restrictive policy is added.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ec_shared_services' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.ec_shared_services ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to ec_shared_services';
  END IF;
END$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.ec_shared_services t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE c.id = t.provider_company_id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);

    UPDATE public.ec_shared_services t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE t.tenant_id IS NULL AND c.id = t.consumer_company_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Backfill ec_shared_services skipped: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  IF (SELECT count(1) FROM public.ec_shared_services WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.ec_shared_services ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on ec_shared_services: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='public' AND tc.table_name='ec_shared_services' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      BEGIN
        ALTER TABLE public.ec_shared_services ADD CONSTRAINT fk_ec_shared_services_tenant
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant FK on ec_shared_services: %', SQLERRM;
      END;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ec_shared_services_tenant ON public.ec_shared_services (tenant_id)';
  EXECUTE 'ALTER TABLE public.ec_shared_services ENABLE ROW LEVEL SECURITY';
END$$;
COMMIT;
