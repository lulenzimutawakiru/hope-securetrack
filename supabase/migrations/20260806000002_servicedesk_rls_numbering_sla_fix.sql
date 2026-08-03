-- Corrective migration: historical over-grant revoke + tenant hardening
-- 1) Remove sd.agent from non-service roles (00030 cross-joined it to ALL roles)
-- 2) Auditor is read-only (view/portal only)
-- 3) tenant_id + trigger + restrictive RLS for sd_messages, sd_inbound_items
-- 4) tenant trigger for sd_ticket_events + sd_ai_sessions
-- 5) Idempotent re-assertion of the agents-only UPDATE policy and tenant
--    column/trigger on support_tickets (covers DBs that ran an earlier draft)

BEGIN;

-- ============================================================
-- 1. Revoke sd.agent from non-service roles (historical over-grant)
-- ============================================================
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND p.slug = 'sd.agent'
  AND r.slug <> 'super_administrator'
  AND r.slug <> 'platform_admin'
  AND r.slug NOT LIKE '%agent%'
  AND r.slug NOT LIKE '%support%'
  AND r.slug NOT LIKE '%helpdesk%'
  AND r.slug NOT LIKE 'it_%'
  AND r.slug NOT LIKE '%desk%';

-- ============================================================
-- 2. Auditor read-only
-- ============================================================
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.slug = 'auditor'
  AND p.slug IN ('sd.manage','sd.admin','sd.change','sd.knowledge','sd.field','sd.ai','sd.agent');

-- ============================================================
-- 3. Tenant hardening helper: add tenant_id + backfill + FK + index
-- ============================================================
DO $$
DECLARE
  t text;
  v_has_tenants boolean;
  v_has_fk boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') INTO v_has_tenants;
  FOREACH t IN ARRAY ARRAY['sd_messages','sd_inbound_items']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID', t);
    EXECUTE format($q$
      UPDATE public.%I x SET tenant_id = c.tenant_id
      FROM public.companies c WHERE x.company_id = c.id AND x.tenant_id IS NULL
    $q$, t);
    IF v_has_tenants THEN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
        WHERE tc.table_schema='public' AND tc.table_name=t
          AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
      ) INTO v_has_fk;
      IF NOT v_has_fk THEN
        EXECUTE format($q$
          ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id)
          REFERENCES public.tenants(id) ON DELETE SET NULL
        $q$, t, 'fk_' || t || '_tenant');
      END IF;
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, company_id)',
                   'idx_' || t || '_tenant_company', t);
  END LOOP;
END $$;

-- Restrictive tenant isolation on sd_messages + sd_inbound_items
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sd_messages','sd_inbound_items']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_restrict ON public.%I', t);
      EXECUTE format($q$
        CREATE POLICY tenant_isolation_restrict ON public.%I
        AS RESTRICTIVE FOR ALL TO authenticated
        USING (public.tenant_company_access(tenant_id, company_id))
        WITH CHECK (public.tenant_company_access(tenant_id, company_id))
      $q$, t);
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_set_tenant_from_company ON public.sd_messages;
CREATE TRIGGER trg_set_tenant_from_company
  BEFORE INSERT OR UPDATE OF company_id, tenant_id ON public.sd_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_tenant_from_company();

DROP TRIGGER IF EXISTS trg_set_tenant_from_company ON public.sd_inbound_items;
CREATE TRIGGER trg_set_tenant_from_company
  BEFORE INSERT OR UPDATE OF company_id, tenant_id ON public.sd_inbound_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_tenant_from_company();

-- ============================================================
-- 4. Tenant trigger for tables that carry tenant_id but lack the trigger
-- ============================================================
DROP TRIGGER IF EXISTS trg_set_tenant_from_company ON public.sd_ticket_events;
CREATE TRIGGER trg_set_tenant_from_company
  BEFORE INSERT OR UPDATE OF company_id, tenant_id ON public.sd_ticket_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_tenant_from_company();

DROP TRIGGER IF EXISTS trg_set_tenant_from_company ON public.sd_ai_sessions;
CREATE TRIGGER trg_set_tenant_from_company
  BEFORE INSERT OR UPDATE OF company_id, tenant_id ON public.sd_ai_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_tenant_from_company();

-- ============================================================
-- 5. support_tickets re-assertion (idempotent; belt and braces)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='support_tickets' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.support_tickets ADD COLUMN tenant_id UUID;
  END IF;
  UPDATE public.support_tickets t SET tenant_id = c.tenant_id
  FROM public.companies c WHERE t.company_id = c.id AND t.tenant_id IS NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
      WHERE tc.table_name='support_tickets' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
    ) THEN
      ALTER TABLE public.support_tickets
        ADD CONSTRAINT fk_support_tickets_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_company ON public.support_tickets (tenant_id, company_id)';
END $$;

DROP TRIGGER IF EXISTS trg_set_tenant_from_company ON public.support_tickets;
CREATE TRIGGER trg_set_tenant_from_company
  BEFORE INSERT OR UPDATE OF company_id, tenant_id ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_tenant_from_company();

DROP POLICY IF EXISTS tenant_isolation_restrict ON public.support_tickets;
CREATE POLICY tenant_isolation_restrict ON public.support_tickets
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tenant_company_access(tenant_id, company_id))
  WITH CHECK (public.tenant_company_access(tenant_id, company_id));

-- Agents-only UPDATE (requesters comment via sd_ticket_events, they do not
-- mutate ticket rows directly).
DROP POLICY IF EXISTS support_tickets_write_restrict_update ON support_tickets;
CREATE POLICY support_tickets_write_restrict_update ON support_tickets
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.admin']::varchar[])
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.admin']::varchar[])
  );

-- Realtime reads for sd_messages / sd_inbound_items must be company-scoped
-- (permissive _all policies already exist; ensure publication membership).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['support_tickets','sd_ticket_events','sd_messages','sd_inbound_items','sd_escalation_events']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;

COMMIT;