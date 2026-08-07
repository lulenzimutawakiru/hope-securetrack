-- =============================================================================
-- SecureTrack ERP: tenant-scope remaining legacy CHILD / line-item tables
-- -----------------------------------------------------------------------------
-- Adds tenant_id (and company_id where missing) to 8 child tables that were
-- created before the platform-wide tenant isolation push. Backfill is derived
-- from each row's parent header (parents already carry company_id + tenant_id).
--
-- * company_id  -> backfilled from parent, FK companies(id) ON DELETE CASCADE
-- * tenant_id   -> backfilled from companies.tenant_id
-- * NOT NULL    -> applied only when every row resolves to a tenant
--                  (the tenant-less "SecureTrack ERP Operations" staff company
--                  intentionally keeps NULL tenant rows)
-- * RLS         -> enabled; restrictive tenant_isolation_restrict policy via
--                  tenant_company_access(tenant_id, company_id) AND'd with the
--                  existing company-scoped permissive policies (defense in depth)
--
-- Idempotent; safe to re-run.
-- =============================================================================
BEGIN;
-- =============================================================================
-- crm_campaign_members  (child of crm_campaigns)
-- Add company_id + tenant_id, backfill from parent header, enforce isolation.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_campaign_members' AND column_name='company_id'
  ) THEN
    ALTER TABLE public.crm_campaign_members ADD COLUMN company_id UUID;
    RAISE NOTICE 'Added company_id to crm_campaign_members';
  END IF;

  UPDATE public.crm_campaign_members x
  SET company_id = p.company_id
  FROM public.crm_campaigns p
  WHERE x.campaign_id = p.id AND x.company_id IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_schema='public' AND tc.table_name='crm_campaign_members'
      AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='company_id'
  ) THEN
    BEGIN
      ALTER TABLE public.crm_campaign_members ADD CONSTRAINT fk_crm_campaign_members_company
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add company FK on crm_campaign_members: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_campaign_members' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.crm_campaign_members ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to crm_campaign_members';
  END IF;
END$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.crm_campaign_members t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Backfill crm_campaign_members skipped: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  IF (SELECT count(1) FROM public.crm_campaign_members WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.crm_campaign_members ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on crm_campaign_members: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='public' AND tc.table_name='crm_campaign_members' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      BEGIN
        ALTER TABLE public.crm_campaign_members ADD CONSTRAINT fk_crm_campaign_members_tenant
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant FK on crm_campaign_members: %', SQLERRM;
      END;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_crm_campaign_members_tenant ON public.crm_campaign_members (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_crm_campaign_members_tenant_company ON public.crm_campaign_members (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.crm_campaign_members ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.crm_campaign_members';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.crm_campaign_members';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.crm_campaign_members';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.crm_campaign_members AS RESTRICTIVE FOR ALL
      USING (public.tenant_company_access(tenant_id, company_id))
      WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.crm_campaign_members FOR SELECT USING (
      tenant_id = public.current_user_tenant()
      AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.crm_campaign_members.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.crm_campaign_members FOR ALL
      USING (tenant_id = public.current_user_tenant())
      WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;
-- =============================================================================
-- crm_dealer_targets  (child of crm_dealers)
-- Add company_id + tenant_id, backfill from parent header, enforce isolation.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_dealer_targets' AND column_name='company_id'
  ) THEN
    ALTER TABLE public.crm_dealer_targets ADD COLUMN company_id UUID;
    RAISE NOTICE 'Added company_id to crm_dealer_targets';
  END IF;

  UPDATE public.crm_dealer_targets x
  SET company_id = p.company_id
  FROM public.crm_dealers p
  WHERE x.dealer_id = p.id AND x.company_id IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_schema='public' AND tc.table_name='crm_dealer_targets'
      AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='company_id'
  ) THEN
    BEGIN
      ALTER TABLE public.crm_dealer_targets ADD CONSTRAINT fk_crm_dealer_targets_company
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add company FK on crm_dealer_targets: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_dealer_targets' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.crm_dealer_targets ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to crm_dealer_targets';
  END IF;
END$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.crm_dealer_targets t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Backfill crm_dealer_targets skipped: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  IF (SELECT count(1) FROM public.crm_dealer_targets WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.crm_dealer_targets ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on crm_dealer_targets: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='public' AND tc.table_name='crm_dealer_targets' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      BEGIN
        ALTER TABLE public.crm_dealer_targets ADD CONSTRAINT fk_crm_dealer_targets_tenant
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant FK on crm_dealer_targets: %', SQLERRM;
      END;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_crm_dealer_targets_tenant ON public.crm_dealer_targets (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_crm_dealer_targets_tenant_company ON public.crm_dealer_targets (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.crm_dealer_targets ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.crm_dealer_targets';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.crm_dealer_targets';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.crm_dealer_targets';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.crm_dealer_targets AS RESTRICTIVE FOR ALL
      USING (public.tenant_company_access(tenant_id, company_id))
      WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.crm_dealer_targets FOR SELECT USING (
      tenant_id = public.current_user_tenant()
      AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.crm_dealer_targets.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.crm_dealer_targets FOR ALL
      USING (tenant_id = public.current_user_tenant())
      WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;
-- =============================================================================
-- crm_loyalty_tiers  (child of crm_loyalty_programs)
-- Add company_id + tenant_id, backfill from parent header, enforce isolation.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_loyalty_tiers' AND column_name='company_id'
  ) THEN
    ALTER TABLE public.crm_loyalty_tiers ADD COLUMN company_id UUID;
    RAISE NOTICE 'Added company_id to crm_loyalty_tiers';
  END IF;

  UPDATE public.crm_loyalty_tiers x
  SET company_id = p.company_id
  FROM public.crm_loyalty_programs p
  WHERE x.program_id = p.id AND x.company_id IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_schema='public' AND tc.table_name='crm_loyalty_tiers'
      AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='company_id'
  ) THEN
    BEGIN
      ALTER TABLE public.crm_loyalty_tiers ADD CONSTRAINT fk_crm_loyalty_tiers_company
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add company FK on crm_loyalty_tiers: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_loyalty_tiers' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.crm_loyalty_tiers ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to crm_loyalty_tiers';
  END IF;
END$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.crm_loyalty_tiers t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Backfill crm_loyalty_tiers skipped: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  IF (SELECT count(1) FROM public.crm_loyalty_tiers WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.crm_loyalty_tiers ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on crm_loyalty_tiers: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='public' AND tc.table_name='crm_loyalty_tiers' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      BEGIN
        ALTER TABLE public.crm_loyalty_tiers ADD CONSTRAINT fk_crm_loyalty_tiers_tenant
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant FK on crm_loyalty_tiers: %', SQLERRM;
      END;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_crm_loyalty_tiers_tenant ON public.crm_loyalty_tiers (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_crm_loyalty_tiers_tenant_company ON public.crm_loyalty_tiers (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.crm_loyalty_tiers ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.crm_loyalty_tiers';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.crm_loyalty_tiers';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.crm_loyalty_tiers';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.crm_loyalty_tiers AS RESTRICTIVE FOR ALL
      USING (public.tenant_company_access(tenant_id, company_id))
      WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.crm_loyalty_tiers FOR SELECT USING (
      tenant_id = public.current_user_tenant()
      AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.crm_loyalty_tiers.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.crm_loyalty_tiers FOR ALL
      USING (tenant_id = public.current_user_tenant())
      WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;
-- =============================================================================
-- crm_segment_members  (child of crm_segments)
-- Add company_id + tenant_id, backfill from parent header, enforce isolation.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_segment_members' AND column_name='company_id'
  ) THEN
    ALTER TABLE public.crm_segment_members ADD COLUMN company_id UUID;
    RAISE NOTICE 'Added company_id to crm_segment_members';
  END IF;

  UPDATE public.crm_segment_members x
  SET company_id = p.company_id
  FROM public.crm_segments p
  WHERE x.segment_id = p.id AND x.company_id IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_schema='public' AND tc.table_name='crm_segment_members'
      AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='company_id'
  ) THEN
    BEGIN
      ALTER TABLE public.crm_segment_members ADD CONSTRAINT fk_crm_segment_members_company
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add company FK on crm_segment_members: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_segment_members' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.crm_segment_members ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to crm_segment_members';
  END IF;
END$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.crm_segment_members t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Backfill crm_segment_members skipped: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  IF (SELECT count(1) FROM public.crm_segment_members WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.crm_segment_members ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on crm_segment_members: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='public' AND tc.table_name='crm_segment_members' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      BEGIN
        ALTER TABLE public.crm_segment_members ADD CONSTRAINT fk_crm_segment_members_tenant
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant FK on crm_segment_members: %', SQLERRM;
      END;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_crm_segment_members_tenant ON public.crm_segment_members (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_crm_segment_members_tenant_company ON public.crm_segment_members (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.crm_segment_members ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.crm_segment_members';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.crm_segment_members';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.crm_segment_members';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.crm_segment_members AS RESTRICTIVE FOR ALL
      USING (public.tenant_company_access(tenant_id, company_id))
      WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.crm_segment_members FOR SELECT USING (
      tenant_id = public.current_user_tenant()
      AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.crm_segment_members.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.crm_segment_members FOR ALL
      USING (tenant_id = public.current_user_tenant())
      WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;
-- =============================================================================
-- dispatch_items  (child of dispatches)
-- Add company_id + tenant_id, backfill from parent header, enforce isolation.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dispatch_items' AND column_name='company_id'
  ) THEN
    ALTER TABLE public.dispatch_items ADD COLUMN company_id UUID;
    RAISE NOTICE 'Added company_id to dispatch_items';
  END IF;

  UPDATE public.dispatch_items x
  SET company_id = p.company_id
  FROM public.dispatches p
  WHERE x.dispatch_id = p.id AND x.company_id IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_schema='public' AND tc.table_name='dispatch_items'
      AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='company_id'
  ) THEN
    BEGIN
      ALTER TABLE public.dispatch_items ADD CONSTRAINT fk_dispatch_items_company
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add company FK on dispatch_items: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dispatch_items' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.dispatch_items ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to dispatch_items';
  END IF;
END$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.dispatch_items t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Backfill dispatch_items skipped: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  IF (SELECT count(1) FROM public.dispatch_items WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.dispatch_items ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on dispatch_items: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='public' AND tc.table_name='dispatch_items' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      BEGIN
        ALTER TABLE public.dispatch_items ADD CONSTRAINT fk_dispatch_items_tenant
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant FK on dispatch_items: %', SQLERRM;
      END;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_dispatch_items_tenant ON public.dispatch_items (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_dispatch_items_tenant_company ON public.dispatch_items (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.dispatch_items ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.dispatch_items';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.dispatch_items';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.dispatch_items';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.dispatch_items AS RESTRICTIVE FOR ALL
      USING (public.tenant_company_access(tenant_id, company_id))
      WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.dispatch_items FOR SELECT USING (
      tenant_id = public.current_user_tenant()
      AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.dispatch_items.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.dispatch_items FOR ALL
      USING (tenant_id = public.current_user_tenant())
      WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;
-- =============================================================================
-- invoice_lines  (child of invoices)
-- Add company_id + tenant_id, backfill from parent header, enforce isolation.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoice_lines' AND column_name='company_id'
  ) THEN
    ALTER TABLE public.invoice_lines ADD COLUMN company_id UUID;
    RAISE NOTICE 'Added company_id to invoice_lines';
  END IF;

  UPDATE public.invoice_lines x
  SET company_id = p.company_id
  FROM public.invoices p
  WHERE x.invoice_id = p.id AND x.company_id IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_schema='public' AND tc.table_name='invoice_lines'
      AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='company_id'
  ) THEN
    BEGIN
      ALTER TABLE public.invoice_lines ADD CONSTRAINT fk_invoice_lines_company
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add company FK on invoice_lines: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoice_lines' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.invoice_lines ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to invoice_lines';
  END IF;
END$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.invoice_lines t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Backfill invoice_lines skipped: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  IF (SELECT count(1) FROM public.invoice_lines WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.invoice_lines ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on invoice_lines: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='public' AND tc.table_name='invoice_lines' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      BEGIN
        ALTER TABLE public.invoice_lines ADD CONSTRAINT fk_invoice_lines_tenant
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant FK on invoice_lines: %', SQLERRM;
      END;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invoice_lines_tenant ON public.invoice_lines (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invoice_lines_tenant_company ON public.invoice_lines (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.invoice_lines';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.invoice_lines';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.invoice_lines';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.invoice_lines AS RESTRICTIVE FOR ALL
      USING (public.tenant_company_access(tenant_id, company_id))
      WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.invoice_lines FOR SELECT USING (
      tenant_id = public.current_user_tenant()
      AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.invoice_lines.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.invoice_lines FOR ALL
      USING (tenant_id = public.current_user_tenant())
      WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;
-- =============================================================================
-- sales_return_lines  (child of sales_returns)
-- Add company_id + tenant_id, backfill from parent header, enforce isolation.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='sales_return_lines' AND column_name='company_id'
  ) THEN
    ALTER TABLE public.sales_return_lines ADD COLUMN company_id UUID;
    RAISE NOTICE 'Added company_id to sales_return_lines';
  END IF;

  UPDATE public.sales_return_lines x
  SET company_id = p.company_id
  FROM public.sales_returns p
  WHERE x.return_id = p.id AND x.company_id IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_schema='public' AND tc.table_name='sales_return_lines'
      AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='company_id'
  ) THEN
    BEGIN
      ALTER TABLE public.sales_return_lines ADD CONSTRAINT fk_sales_return_lines_company
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add company FK on sales_return_lines: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='sales_return_lines' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.sales_return_lines ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to sales_return_lines';
  END IF;
END$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.sales_return_lines t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Backfill sales_return_lines skipped: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  IF (SELECT count(1) FROM public.sales_return_lines WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.sales_return_lines ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on sales_return_lines: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='public' AND tc.table_name='sales_return_lines' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      BEGIN
        ALTER TABLE public.sales_return_lines ADD CONSTRAINT fk_sales_return_lines_tenant
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant FK on sales_return_lines: %', SQLERRM;
      END;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sales_return_lines_tenant ON public.sales_return_lines (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sales_return_lines_tenant_company ON public.sales_return_lines (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.sales_return_lines ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.sales_return_lines';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.sales_return_lines';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.sales_return_lines';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.sales_return_lines AS RESTRICTIVE FOR ALL
      USING (public.tenant_company_access(tenant_id, company_id))
      WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.sales_return_lines FOR SELECT USING (
      tenant_id = public.current_user_tenant()
      AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.sales_return_lines.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.sales_return_lines FOR ALL
      USING (tenant_id = public.current_user_tenant())
      WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;
-- =============================================================================
-- warehouse_racks  (child of warehouses)
-- Add company_id + tenant_id, backfill from parent header, enforce isolation.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='warehouse_racks' AND column_name='company_id'
  ) THEN
    ALTER TABLE public.warehouse_racks ADD COLUMN company_id UUID;
    RAISE NOTICE 'Added company_id to warehouse_racks';
  END IF;

  UPDATE public.warehouse_racks x
  SET company_id = p.company_id
  FROM public.warehouses p
  WHERE x.warehouse_id = p.id AND x.company_id IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.table_schema='public' AND tc.table_name='warehouse_racks'
      AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='company_id'
  ) THEN
    BEGIN
      ALTER TABLE public.warehouse_racks ADD CONSTRAINT fk_warehouse_racks_company
        FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add company FK on warehouse_racks: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='warehouse_racks' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.warehouse_racks ADD COLUMN tenant_id UUID;
    RAISE NOTICE 'Added tenant_id to warehouse_racks';
  END IF;
END$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.warehouse_racks t SET tenant_id = c.tenant_id
    FROM public.companies c
    WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Backfill warehouse_racks skipped: %', SQLERRM;
  END;
END$$;

DO $$
BEGIN
  IF (SELECT count(1) FROM public.warehouse_racks WHERE tenant_id IS NULL) = 0 THEN
    BEGIN
      ALTER TABLE public.warehouse_racks ALTER COLUMN tenant_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set NOT NULL on warehouse_racks: %', SQLERRM;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='public' AND tc.table_name='warehouse_racks' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id') THEN
      BEGIN
        ALTER TABLE public.warehouse_racks ADD CONSTRAINT fk_warehouse_racks_tenant
          FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tenant FK on warehouse_racks: %', SQLERRM;
      END;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_warehouse_racks_tenant ON public.warehouse_racks (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_warehouse_racks_tenant_company ON public.warehouse_racks (tenant_id, company_id)';
  EXECUTE 'ALTER TABLE public.warehouse_racks ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_restrict ON public.warehouse_racks';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.warehouse_racks';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_write ON public.warehouse_racks';
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    EXECUTE $sql$CREATE POLICY tenant_isolation_restrict ON public.warehouse_racks AS RESTRICTIVE FOR ALL
      USING (public.tenant_company_access(tenant_id, company_id))
      WITH CHECK (public.tenant_company_access(tenant_id, company_id))$sql$;
  ELSE
    EXECUTE $sql$CREATE POLICY tenant_isolation_select ON public.warehouse_racks FOR SELECT USING (
      tenant_id = public.current_user_tenant()
      AND EXISTS (SELECT 1 FROM public.user_company_memberships m WHERE m.company_id = public.warehouse_racks.company_id AND m.user_id = auth.uid() AND m.status = 'active')
    )$sql$;
    EXECUTE $sql$CREATE POLICY tenant_isolation_write ON public.warehouse_racks FOR ALL
      USING (tenant_id = public.current_user_tenant())
      WITH CHECK (tenant_id = public.current_user_tenant())$sql$;
  END IF;
END$$;
COMMIT;
