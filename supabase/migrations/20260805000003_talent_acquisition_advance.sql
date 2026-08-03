-- =============================================================================
-- SecureTrack ERP - Talent Acquisition Advancement
-- Collaboration: comments + attachments on TA entities
-- Workflow: application stage-change notifications + queued email + vacancy counts
-- Tenant-safe: company-scoped + RESTRICTIVE tenant isolation + spoof guard
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ta_comments - internal collaboration notes on any TA entity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ta_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tenant_id UUID,
  ref_table VARCHAR(80) NOT NULL,
  ref_id UUID NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name VARCHAR(160),
  body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ta_comments_ref
  ON public.ta_comments(company_id, ref_table, ref_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.ta_comments IS 'Internal collaboration comments on talent acquisition entities';

-- ---------------------------------------------------------------------------
-- 2. ta_attachments - file metadata for TA entities (objects live in storage)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ta_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tenant_id UUID,
  ref_table VARCHAR(80) NOT NULL,
  ref_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(120),
  file_size_bytes BIGINT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ta_attachments_ref
  ON public.ta_attachments(company_id, ref_table, ref_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.ta_attachments IS 'Attachment metadata for talent acquisition entities (objects in attachments bucket)';

-- ---------------------------------------------------------------------------
-- 3. RLS - both new tables: company access + TA permission write gate
--    + RESTRICTIVE tenant isolation + spoof-guard trigger (migration 71 pattern)
-- ---------------------------------------------------------------------------
ALTER TABLE public.ta_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ta_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ta_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ta_attachments FORCE ROW LEVEL SECURITY;

-- Backfill tenant_id from companies (migration 71's dynamic loop already ran)
UPDATE public.ta_comments tc SET tenant_id = c.tenant_id
  FROM public.companies c WHERE c.id = tc.company_id AND tc.tenant_id IS NULL;
UPDATE public.ta_attachments ta SET tenant_id = c.tenant_id
  FROM public.companies c WHERE c.id = ta.company_id AND ta.tenant_id IS NULL;

-- tenant_id is mandatory for tenant isolation
ALTER TABLE public.ta_comments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.ta_attachments ALTER COLUMN tenant_id SET NOT NULL;

-- ta_comments policies
DROP POLICY IF EXISTS ta_comments_select ON public.ta_comments;
CREATE POLICY ta_comments_select ON public.ta_comments FOR SELECT TO authenticated
  USING (company_id = public.user_company_id());

DROP POLICY IF EXISTS ta_comments_insert ON public.ta_comments;
CREATE POLICY ta_comments_insert ON public.ta_comments FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.user_company_id()
    AND author_id = auth.uid()
    AND (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']))
  );

DROP POLICY IF EXISTS ta_comments_update ON public.ta_comments;
CREATE POLICY ta_comments_update ON public.ta_comments FOR UPDATE TO authenticated
  USING (
    company_id = public.user_company_id()
    AND (author_id = auth.uid() OR public.is_super_admin() OR public.has_any_permission(ARRAY['ta.admin','ta.manage']))
  )
  WITH CHECK (
    company_id = public.user_company_id()
    AND (author_id = auth.uid() OR public.is_super_admin() OR public.has_any_permission(ARRAY['ta.admin','ta.manage']))
  );

DROP POLICY IF EXISTS ta_comments_delete ON public.ta_comments;
CREATE POLICY ta_comments_delete ON public.ta_comments FOR DELETE TO authenticated
  USING (
    company_id = public.user_company_id()
    AND (author_id = auth.uid() OR public.is_super_admin() OR public.has_any_permission(ARRAY['ta.admin','ta.manage']))
  );

-- ta_attachments policies
DROP POLICY IF EXISTS ta_attachments_select ON public.ta_attachments;
CREATE POLICY ta_attachments_select ON public.ta_attachments FOR SELECT TO authenticated
  USING (company_id = public.user_company_id());

DROP POLICY IF EXISTS ta_attachments_insert ON public.ta_attachments;
CREATE POLICY ta_attachments_insert ON public.ta_attachments FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.user_company_id()
    AND uploaded_by = auth.uid()
    AND (public.is_super_admin() OR public.has_any_permission(ARRAY['ta.manage','ta.admin','ta.recruit','ta.approve','hr.recruit']))
  );

DROP POLICY IF EXISTS ta_attachments_update ON public.ta_attachments;
CREATE POLICY ta_attachments_update ON public.ta_attachments FOR UPDATE TO authenticated
  USING (
    company_id = public.user_company_id()
    AND (uploaded_by = auth.uid() OR public.is_super_admin() OR public.has_any_permission(ARRAY['ta.admin','ta.manage']))
  )
  WITH CHECK (
    company_id = public.user_company_id()
    AND (uploaded_by = auth.uid() OR public.is_super_admin() OR public.has_any_permission(ARRAY['ta.admin','ta.manage']))
  );

DROP POLICY IF EXISTS ta_attachments_delete ON public.ta_attachments;
CREATE POLICY ta_attachments_delete ON public.ta_attachments FOR DELETE TO authenticated
  USING (
    company_id = public.user_company_id()
    AND (uploaded_by = auth.uid() OR public.is_super_admin() OR public.has_any_permission(ARRAY['ta.admin','ta.manage']))
  );

-- RESTRICTIVE dual-key tenant isolation (same shape migration 71 applied to all tables)
DROP POLICY IF EXISTS tenant_isolation_restrict ON public.ta_comments;
CREATE POLICY tenant_isolation_restrict ON public.ta_comments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tenant_company_access(tenant_id, company_id))
  WITH CHECK (public.tenant_company_access(tenant_id, company_id));

DROP POLICY IF EXISTS tenant_isolation_restrict ON public.ta_attachments;
CREATE POLICY tenant_isolation_restrict ON public.ta_attachments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tenant_company_access(tenant_id, company_id))
  WITH CHECK (public.tenant_company_access(tenant_id, company_id));

-- Spoof-guard: tenant_id is always derived from the company server-side
DROP TRIGGER IF EXISTS trg_set_tenant_from_company ON public.ta_comments;
CREATE TRIGGER trg_set_tenant_from_company
  BEFORE INSERT OR UPDATE OF company_id, tenant_id ON public.ta_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_tenant_from_company();

DROP TRIGGER IF EXISTS trg_set_tenant_from_company ON public.ta_attachments;
CREATE TRIGGER trg_set_tenant_from_company
  BEFORE INSERT OR UPDATE OF company_id, tenant_id ON public.ta_attachments
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_tenant_from_company();

-- updated_at maintenance
DROP TRIGGER IF EXISTS tr_ta_comments_updated_at ON public.ta_comments;
CREATE TRIGGER tr_ta_comments_updated_at
  BEFORE UPDATE ON public.ta_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS tr_ta_attachments_updated_at ON public.ta_attachments;
CREATE TRIGGER tr_ta_attachments_updated_at
  BEFORE UPDATE ON public.ta_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Application stage-change workflow: notifications + queued email
--    Fires on ta_applications.stage_code change; syncs stage_name/last_stage_at;
--    notifies active users with TA permission in the company; respects
--    notification_preferences.email_enabled; enqueues email.send jobs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ta_notify_application_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_stage_name VARCHAR;
  v_recipient UUID;
  v_email_enabled BOOLEAN;
  v_outbox UUID;
  v_actor UUID := auth.uid();
BEGIN
  IF NEW.stage_code IS DISTINCT FROM OLD.stage_code THEN
    SELECT name INTO v_stage_name
    FROM public.ta_pipeline_stages
    WHERE company_id = NEW.company_id
      AND stage_code = NEW.stage_code
      AND status = 'active'
      AND deleted_at IS NULL
    LIMIT 1;

    NEW.stage_name := COALESCE(v_stage_name, NEW.stage_code, OLD.stage_name);
    NEW.last_stage_at := NOW();

    SELECT tenant_id INTO v_tenant FROM public.companies WHERE id = NEW.company_id;

    FOR v_recipient IN
      SELECT DISTINCT up.id
      FROM public.user_profiles up
      LEFT JOIN public.roles r ON r.id = up.role_id
      LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
      LEFT JOIN public.permissions p ON p.id = rp.permission_id
      WHERE up.company_id = NEW.company_id
        AND up.is_active = true
        AND (public.is_super_admin() OR p.slug IN ('ta.manage','ta.admin','ta.recruit','ta.approve'))
    LOOP
      INSERT INTO public.notifications
        (company_id, user_id, type, title, message, link, category, priority, channels,
         source_module, source_event, entity_type, entity_id, created_by, is_read)
      VALUES
        (NEW.company_id, v_recipient, 'info',
         format('Application %s moved to %s', NEW.application_number, COALESCE(NEW.stage_name, NEW.stage_code)),
         format('%s - %s', COALESCE(NEW.candidate_name, 'Candidate'), COALESCE(NEW.vacancy_title, 'Vacancy')),
         '/dashboard/talent/ats', 'talent', 'normal', ARRAY['in_app','email']::text[],
         'talent', 'application.stage_change', 'ta_application', NEW.id, v_actor, false);

      IF v_tenant IS NOT NULL THEN
        SELECT COALESCE(email_enabled, true) INTO v_email_enabled
        FROM public.notification_preferences
        WHERE company_id = NEW.company_id AND user_id = v_recipient;

        IF v_email_enabled IS NOT FALSE THEN
          INSERT INTO public.email_outbox
            (company_id, provider, to_addresses, subject, status, payload, sent_by)
          VALUES
            (NEW.company_id, 'resend',
             ARRAY[(SELECT email FROM public.user_profiles WHERE id = v_recipient)],
             format('Application %s moved to %s', NEW.application_number, COALESCE(NEW.stage_name, NEW.stage_code)),
             'queued',
             jsonb_build_object('application_id', NEW.id, 'notification_type', 'ta_stage_change'),
             v_actor)
          RETURNING id INTO v_outbox;

          INSERT INTO public.job_queue (company_id, tenant_id, job_type, payload, status, attempts, max_attempts, priority)
          VALUES (NEW.company_id, v_tenant, 'email.send',
                  jsonb_build_object(
                    'to', (SELECT email FROM public.user_profiles WHERE id = v_recipient),
                    'subject', format('Application %s moved to %s', NEW.application_number, COALESCE(NEW.stage_name, NEW.stage_code)),
                    'body', format('%s has moved application %s (%s) to the "%s" stage. View it in SecureTrack ERP under Talent > Pipeline.',
                                   COALESCE(NEW.candidate_name, 'A candidate'), NEW.application_number,
                                   COALESCE(NEW.vacancy_title, ''), COALESCE(NEW.stage_name, NEW.stage_code)),
                    'outbox_id', v_outbox),
                  'pending', 0, 5, 50);
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_ta_application_stage_notify ON public.ta_applications;
CREATE TRIGGER tr_ta_application_stage_notify
  BEFORE UPDATE OF stage_code ON public.ta_applications
  FOR EACH ROW EXECUTE FUNCTION public.ta_notify_application_stage_change();

-- ---------------------------------------------------------------------------
-- 5. Keep ta_vacancies.applications_count accurate on new applications
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ta_sync_vacancy_application_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vacancy_code IS NOT NULL THEN
    UPDATE public.ta_vacancies
    SET applications_count = COALESCE(applications_count, 0) + 1,
        updated_at = NOW()
    WHERE company_id = NEW.company_id
      AND vacancy_code = NEW.vacancy_code
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_ta_sync_vacancy_application_count ON public.ta_applications;
CREATE TRIGGER tr_ta_sync_vacancy_application_count
  AFTER INSERT ON public.ta_applications
  FOR EACH ROW EXECUTE FUNCTION public.ta_sync_vacancy_application_count();
