-- Service Desk ESM hardening pass 3
-- 1) SLA re-anchor trigger: status/priority changes now re-compute due dates
--    (previously anchored only at creation; stale deadlines on re-open/escalation)
-- 2) RLS parity: sd_escalation_events re-asserted to match sd_ticket_events
--    (permissive company _all + RESTRICTIVE tenant policy + tenant trigger)
-- 3) tenant_id pass for sd_teams, sd_agents, sd_sla_policies, sd_categories
--    (full dual-key isolation like sd_messages / sd_inbound_items)
-- 4) Seed default SLA policies + escalation rules for EVERY company
--    (00030 only seeded the first company; the SLA engine no-ops without them)
-- 5) preview_support_ticket_number() - non-consuming RPC for the POST-only
--    numbering API (integrators can show a number without orphaning the sequence)

BEGIN;

-- ============================================================
-- 1. SLA re-anchor trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_support_ticket_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy public.sd_sla_policies%ROWTYPE;
  v_response_min integer;
  v_resolve_min integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Only re-anchor when status, priority or deletion actually changed
    IF NEW.status IS NOT DISTINCT FROM OLD.status
       AND NEW.priority IS NOT DISTINCT FROM OLD.priority
       AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Closed / resolved / archived / deleted: SLA clock stops
  IF NEW.deleted_at IS NOT NULL
     OR NEW.status IN ('closed', 'resolved', 'archived', 'customer_confirmation') THEN
    NEW.sla_response_due := NULL;
    NEW.sla_resolve_due := NULL;
    NEW.sla_response_breached := false;
    NEW.sla_resolve_breached := false;
    NEW.last_sla_notified_at := NULL;
    RETURN NEW;
  END IF;

  -- INSERT: preserve server-computed due dates when present (the atomic
  -- numbering path already anchors against the matching policy)
  IF TG_OP = 'INSERT'
     AND NEW.sla_response_due IS NOT NULL
     AND NEW.sla_resolve_due IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Open statuses: match active policy by (company, priority), then code
  SELECT * INTO v_policy
  FROM public.sd_sla_policies
  WHERE company_id = NEW.company_id
    AND priority = NEW.priority
    AND COALESCE(is_active, true)
  ORDER BY created_at
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_policy
    FROM public.sd_sla_policies
    WHERE company_id = NEW.company_id
      AND policy_code = CASE NEW.priority
        WHEN 'critical' THEN 'SLA-P1'
        WHEN 'high' THEN 'SLA-P2'
        WHEN 'low' THEN 'SLA-P4'
        ELSE 'SLA-P3' END
      AND COALESCE(is_active, true)
    LIMIT 1;
  END IF;

  IF FOUND THEN
    v_response_min := COALESCE(v_policy.response_minutes, 60);
    v_resolve_min := COALESCE(v_policy.resolve_minutes, 480);
  ELSE
    -- Fallback mirrors src/lib/service-desk/sla.ts (slaMinutesForPriority)
    v_response_min := CASE NEW.priority
      WHEN 'critical' THEN 15 WHEN 'high' THEN 30 WHEN 'low' THEN 240 ELSE 60 END;
    v_resolve_min := CASE NEW.priority
      WHEN 'critical' THEN 120 WHEN 'high' THEN 240 WHEN 'low' THEN 1440 ELSE 480 END;
  END IF;

  NEW.sla_policy_id := CASE WHEN FOUND THEN v_policy.id ELSE NEW.sla_policy_id END;
  NEW.sla_response_due := NOW() + make_interval(mins => v_response_min);
  NEW.sla_resolve_due := NOW() + make_interval(mins => v_resolve_min);
  NEW.sla_response_breached := false;
  NEW.sla_resolve_breached := false;
  NEW.last_sla_notified_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sla_recalc ON public.support_tickets;
CREATE TRIGGER trg_sla_recalc
  BEFORE INSERT OR UPDATE OF status, priority, deleted_at ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.recalc_support_ticket_sla();

-- ============================================================
-- 2. Tenant pass: sd_teams, sd_agents, sd_sla_policies, sd_categories
--    + idempotent re-assertion for sd_escalation_events (parity)
-- ============================================================
DO $$
DECLARE
  t text;
  v_has_tenants boolean;
  v_has_fk boolean;
  tables text[] := ARRAY['sd_teams','sd_agents','sd_sla_policies','sd_categories','sd_escalation_events'];
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='tenants'
  ) INTO v_has_tenants;

  FOREACH t IN ARRAY tables
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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- RESTRICTIVE tenant policies (AND'd with the existing company-scoped
-- permissive policies). sd_escalation_events is re-created to guarantee
-- parity with sd_ticket_events on databases that ran an earlier draft.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['sd_teams','sd_agents','sd_sla_policies','sd_categories','sd_escalation_events'];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tenant_company_access') THEN
    FOREACH t IN ARRAY tables
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_restrict ON public.%I', t);
      EXECUTE format($q$
        CREATE POLICY tenant_isolation_restrict ON public.%I
        AS RESTRICTIVE FOR ALL TO authenticated
        USING (public.tenant_company_access(tenant_id, company_id))
        WITH CHECK (public.tenant_company_access(tenant_id, company_id))
      $q$, t);
    END LOOP;
  END IF;
END $$;

-- Tenant auto-set triggers (idempotent)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sd_teams','sd_agents','sd_sla_policies','sd_categories','sd_escalation_events']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant_from_company ON public.%I', t);
    EXECUTE format($q$
      CREATE TRIGGER trg_set_tenant_from_company
        BEFORE INSERT OR UPDATE OF company_id, tenant_id ON public.%I
        FOR EACH ROW EXECUTE FUNCTION public.trg_set_tenant_from_company()
    $q$, t);
  END LOOP;
END $$;

-- sd_escalation_events permissive policy (parity with sd_ticket_events _all)
DROP POLICY IF EXISTS sd_escalation_events_all ON public.sd_escalation_events;
CREATE POLICY sd_escalation_events_all ON public.sd_escalation_events FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());

-- ============================================================
-- 3. Seed default SLA policies + escalation rules per company
-- ============================================================
DO $$
DECLARE
  c RECORD;
  v_ops text[];
  v_mgmt text[];
BEGIN
  FOR c IN SELECT id FROM public.companies ORDER BY created_at
  LOOP
    INSERT INTO public.sd_sla_policies
      (company_id, policy_code, name, priority, response_minutes, resolve_minutes,
       business_hours_only, is_active)
    VALUES
      (c.id, 'SLA-P1', 'Critical / P1', 'critical', 15, 120, false, true),
      (c.id, 'SLA-P2', 'High / P2', 'high', 30, 240, false, true),
      (c.id, 'SLA-P3', 'Medium / P3', 'medium', 60, 480, false, true),
      (c.id, 'SLA-P4', 'Low / P4', 'low', 240, 1440, false, true)
    ON CONFLICT (company_id, policy_code) DO NOTHING;

    -- Resolve realistic role slugs for notification targeting; the engine
    -- looks up roles by slug (sla-engine.ts usersForRoles).
    SELECT COALESCE(ARRAY_AGG(slug), ARRAY[]::text[]) INTO v_ops
    FROM (
      SELECT slug FROM public.roles
      WHERE slug LIKE '%support%' OR slug LIKE '%agent%' OR slug LIKE '%desk%'
         OR slug LIKE 'it_%'
         OR slug IN ('operations_manager','super_administrator','platform_admin')
      ORDER BY (slug = 'operations_manager') DESC, slug
      LIMIT 4
    ) s;

    SELECT COALESCE(ARRAY_AGG(slug), ARRAY[]::text[]) INTO v_mgmt
    FROM (
      SELECT slug FROM public.roles
      WHERE slug IN ('managing_director','operations_manager','super_administrator','platform_admin')
      ORDER BY (slug = 'managing_director') DESC, slug
      LIMIT 2
    ) s;

    IF NOT EXISTS (
      SELECT 1 FROM public.sd_escalation_rules
      WHERE company_id = c.id AND name = 'P1 SLA Breach'
    ) THEN
      INSERT INTO public.sd_escalation_rules
        (company_id, name, trigger_type, escalate_to_level, notify_roles, is_active)
      VALUES (c.id, 'P1 SLA Breach', 'sla_breach', 2, v_ops, true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.sd_escalation_rules
      WHERE company_id = c.id AND name = 'Major Incident'
    ) THEN
      INSERT INTO public.sd_escalation_rules
        (company_id, name, trigger_type, escalate_to_level, notify_roles, is_active)
      VALUES (c.id, 'Major Incident', 'major', 3, v_mgmt, true);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 4. Non-consuming ticket number preview (POST-only numbering API)
-- ============================================================
CREATE OR REPLACE FUNCTION public.preview_support_ticket_number(p_company_id uuid)
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

  -- Ensure a sequence row exists (mirrors next_support_ticket_number) but
  -- NEVER consumes: no FOR UPDATE, no next_number bump.
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
    AND COALESCE(is_active, true);

  IF NOT FOUND THEN
    RETURN 'HDG-SD-' || v_year || '-' || lpad('1', 5, '0');
  END IF;

  IF v_seq.reset_rule = 'yearly'
     AND date_part('year', COALESCE(v_seq.updated_at, NOW())) < date_part('year', NOW()) THEN
    v_num := 1;
  ELSE
    v_num := COALESCE(v_seq.next_number, 1);
  END IF;

  RETURN 'HDG-SD-' || v_year || '-' || lpad(v_num::text, COALESCE(v_seq.pad_length, 5), '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_support_ticket_number(uuid) TO authenticated, service_role;

COMMIT;