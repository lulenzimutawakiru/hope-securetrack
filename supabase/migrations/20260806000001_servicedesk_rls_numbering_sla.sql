-- Service Desk ESM foundation
-- 1) Fix RLS gaps: portal self-service create, event/comment logging, and
--    agents-only ticket UPDATE (no requester/assignee row mutation escape)
-- 2) Atomic ticket numbering (race-safe sequences) + tenant_id hardening for
--    document_sequences and support_tickets
-- 3) Escalation/SLA columns + realtime for the live agent workspace

BEGIN;

-- ============================================================
-- 0. Tenant columns (document_sequences + support_tickets)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='document_sequences' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.document_sequences ADD COLUMN tenant_id UUID;
  END IF;
END $$;

DO $$
BEGIN
  UPDATE public.document_sequences ds
  SET tenant_id = c.tenant_id
  FROM public.companies c
  WHERE ds.company_id = c.id AND ds.tenant_id IS NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
      WHERE tc.table_name='document_sequences' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='tenant_id'
    ) THEN
      ALTER TABLE public.document_sequences
        ADD CONSTRAINT fk_document_sequences_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
    END IF;
  END IF;
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_document_sequences_tenant_company ON public.document_sequences (tenant_id, company_id)';
END $$;

DROP TRIGGER IF EXISTS trg_set_tenant_from_company ON public.document_sequences;
CREATE TRIGGER trg_set_tenant_from_company
  BEFORE INSERT OR UPDATE OF company_id, tenant_id ON public.document_sequences
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_tenant_from_company();

-- support_tickets: tenant_id is required by the SLA engine, realtime and
-- multi-tenant isolation (was missing entirely).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='support_tickets' AND column_name='tenant_id'
  ) THEN
    ALTER TABLE public.support_tickets ADD COLUMN tenant_id UUID;
  END IF;
END $$;

DO $$
BEGIN
  UPDATE public.support_tickets t
  SET tenant_id = c.tenant_id
  FROM public.companies c
  WHERE t.company_id = c.id AND t.tenant_id IS NULL;
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

-- Restrictive tenant isolation on the ticket table (additive to the existing
-- company policy; break-glass for platform elevation is inside the function).
DROP POLICY IF EXISTS tenant_isolation_restrict ON public.support_tickets;
CREATE POLICY tenant_isolation_restrict ON public.support_tickets
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tenant_company_access(tenant_id, company_id))
  WITH CHECK (public.tenant_company_access(tenant_id, company_id));

-- ============================================================
-- 1. RLS: support_tickets write gates
-- ============================================================
-- Portal self-service may CREATE tickets (sd.portal). Ticket row UPDATES
-- (status/priority/assignment/SLA) are AGENT-ONLY; requesters comment via
-- sd_ticket_events instead of mutating the ticket row directly.
DROP POLICY IF EXISTS support_tickets_write_restrict_insert ON support_tickets;
CREATE POLICY support_tickets_write_restrict_insert ON support_tickets
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.admin','sd.portal']::varchar[])
  );

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

-- ============================================================
-- 2. RLS: sd_ticket_events write gates
-- ============================================================
-- Requesters (portal) and agents must log comments/events.
-- Also allow the ticket creator/assignee even without agent role.
DROP POLICY IF EXISTS sd_ticket_events_write_restrict_insert ON sd_ticket_events;
CREATE POLICY sd_ticket_events_write_restrict_insert ON sd_ticket_events
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.field','sd.portal']::varchar[])
    OR EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = sd_ticket_events.ticket_id
        AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid())
    )
  );

DROP POLICY IF EXISTS sd_ticket_events_write_restrict_update ON sd_ticket_events;
CREATE POLICY sd_ticket_events_write_restrict_update ON sd_ticket_events
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.field','sd.admin']::varchar[])
    OR actor_id = auth.uid()
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.field','sd.admin']::varchar[])
    OR actor_id = auth.uid()
  );

-- ============================================================
-- 2b. Least-privilege permission grants
-- ============================================================
-- sd.view + sd.portal are universal: every authenticated role can view the
-- service desk (realtime reads) and self-file tickets.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.slug IN ('sd.view', 'sd.portal')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Manage/admin-grade SD permissions for platform + executive/manager roles.
-- sd.agent is intentionally EXCLUDED (agent is an operational working role).
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

-- Auditor is read-only: keep only view/portal for the audit role.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.slug = 'auditor'
  AND p.slug IN ('sd.manage','sd.admin','sd.change','sd.knowledge','sd.field','sd.ai','sd.agent');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.slug LIKE 'sd.%'
  AND p.slug <> 'sd.agent'
  AND r.slug IN (
    'super_administrator', 'platform_admin', 'managing_director',
    'operations_manager', 'hr_manager', 'production_manager'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Agent capability only for operational service-desk / IT / support roles.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.slug = 'sd.agent'
  AND (
    r.slug IN ('super_administrator', 'platform_admin')
    OR r.slug LIKE '%agent%'
    OR r.slug LIKE '%support%'
    OR r.slug LIKE '%helpdesk%'
    OR r.slug LIKE 'it_%'
    OR r.slug LIKE '%desk%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- 3. Atomic ticket numbering
-- ============================================================
INSERT INTO document_sequences (
  company_id, document_type, prefix, include_year, pad_length,
  next_number, sample_format, is_active, tenant_id
)
SELECT
  c.id,
  'support_ticket',
  'HDG-SD-',
  true,
  5,
  1,
  'HDG-SD-{YYYY}-{00001}',
  true,
  c.tenant_id
FROM companies c
ON CONFLICT (company_id, document_type) DO NOTHING;

-- Align sequence with existing ticket volume (avoid collisions)
UPDATE document_sequences ds
SET next_number = GREATEST(ds.next_number, COALESCE(sub.cnt, 0) + 1),
    updated_at = NOW()
FROM (
  SELECT company_id, COUNT(*)::integer AS cnt
  FROM support_tickets
  GROUP BY company_id
) sub
WHERE ds.company_id = sub.company_id
  AND ds.document_type = 'support_ticket';

CREATE OR REPLACE FUNCTION public.next_support_ticket_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq public.document_sequences%ROWTYPE;
  v_num integer;
  v_year text := to_char(CURRENT_DATE, 'YYYY');
  v_tenant uuid;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id required';
  END IF;

  SELECT c.tenant_id INTO v_tenant FROM public.companies c WHERE c.id = p_company_id;
  IF NOT FOUND OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'unknown company or missing tenant';
  END IF;

  INSERT INTO public.document_sequences (
    company_id, document_type, prefix, include_year, pad_length,
    next_number, sample_format, is_active, tenant_id
  )
  SELECT p_company_id, 'support_ticket', 'HDG-SD-', true, 5, 1,
         'HDG-SD-{YYYY}-{00001}', true, v_tenant
  WHERE NOT EXISTS (
    SELECT 1 FROM public.document_sequences
    WHERE company_id = p_company_id AND document_type = 'support_ticket'
  );

  SELECT * INTO v_seq
  FROM public.document_sequences
  WHERE company_id = p_company_id
    AND document_type = 'support_ticket'
    AND COALESCE(is_active, true)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'HDG-SD-' || v_year || '-' || lpad('1', 5, '0');
  END IF;

  -- Yearly reset when configured
  IF v_seq.reset_rule = 'yearly'
     AND date_part('year', COALESCE(v_seq.updated_at, NOW())) < date_part('year', NOW()) THEN
    v_num := 1;
  ELSE
    v_num := COALESCE(v_seq.next_number, 1);
  END IF;

  UPDATE public.document_sequences
  SET next_number = v_num + 1,
      updated_at = NOW()
  WHERE id = v_seq.id;

  RETURN 'HDG-SD-' || v_year || '-' || lpad(v_num::text, COALESCE(v_seq.pad_length, 5), '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_support_ticket_number(uuid) TO authenticated, service_role;

-- ============================================================
-- 4. Escalation / SLA tracking columns
-- ============================================================
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_response_breached BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_resolve_breached BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sla_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_escalation_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sd_tickets_sla_open
  ON public.support_tickets (company_id, sla_resolve_due)
  WHERE deleted_at IS NULL
    AND status NOT IN ('closed', 'resolved', 'archived', 'customer_confirmation');

CREATE INDEX IF NOT EXISTS idx_sd_tickets_escalation
  ON public.support_tickets (company_id, escalation_level)
  WHERE deleted_at IS NULL;

-- Escalation audit trail
CREATE TABLE IF NOT EXISTS public.sd_escalation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.sd_escalation_rules(id) ON DELETE SET NULL,
  from_level INTEGER DEFAULT 0,
  to_level INTEGER NOT NULL,
  trigger_type VARCHAR(40) NOT NULL,
  reason TEXT,
  notified_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sd_escalation_events_ticket
  ON public.sd_escalation_events (ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sd_escalation_events_company
  ON public.sd_escalation_events (company_id, created_at DESC);

DO $$
BEGIN
  UPDATE public.sd_escalation_events e
  SET tenant_id = c.tenant_id
  FROM public.companies c
  WHERE e.company_id = c.id AND e.tenant_id IS NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'escalation events tenant backfill: %', SQLERRM;
END $$;

ALTER TABLE public.sd_escalation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sd_escalation_events_all ON public.sd_escalation_events;
CREATE POLICY sd_escalation_events_all ON public.sd_escalation_events FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());

DROP POLICY IF EXISTS tenant_isolation_restrict ON public.sd_escalation_events;
CREATE POLICY tenant_isolation_restrict ON public.sd_escalation_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tenant_company_access(tenant_id, company_id))
  WITH CHECK (public.tenant_company_access(tenant_id, company_id));

DROP TRIGGER IF EXISTS trg_set_tenant_from_company ON public.sd_escalation_events;
CREATE TRIGGER trg_set_tenant_from_company
  BEFORE INSERT OR UPDATE OF company_id, tenant_id ON public.sd_escalation_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_tenant_from_company();

-- ============================================================
-- 5. Realtime for live agent workspace
-- ============================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'support_tickets',
    'sd_ticket_events',
    'sd_messages',
    'sd_inbound_items',
    'sd_escalation_events'
  ];
BEGIN
  FOREACH t IN ARRAY tables
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

  FOREACH t IN ARRAY ARRAY['support_tickets', 'sd_ticket_events', 'sd_messages']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE %I REPLICA IDENTITY FULL', t);
    END IF;
  END LOOP;
END $$;

COMMIT;