-- ============================================================================
-- SecureTrack ERP - Enterprise Tenant Provisioning Platform
-- Control-plane orchestration: templates, checkpoints, retries, key vault,
-- tenant numbering, API credentials, and job events.
--
-- Platform staff surface only. Every row-level policy is gated behind
-- public.is_platform_admin() so tenant users can never read control-plane rows.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Provisioning templates (tenant templates + industry packs)
--    Metadata-driven: modules, workflows, reports, security baseline, AI,
--    integrations, backup, monitoring, compliance are all stored as JSON config.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provisioning_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'tenant',          -- tenant | industry
  industry VARCHAR(60),
  plan_code VARCHAR(40),
  description TEXT,
  is_system BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,                    -- modules, workflows, security, ai, ...
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provisioning_templates_kind ON provisioning_templates(kind, is_active);

-- ----------------------------------------------------------------------------
-- 2. Tenant encryption key vault (metadata only - raw secrets are never stored)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key_id VARCHAR(64) NOT NULL,
  algorithm VARCHAR(30) NOT NULL DEFAULT 'AES-256-GCM',
  fingerprint VARCHAR(128) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',         -- active | rotated | compromised | revoked
  wrapped_secret TEXT,                                  -- encrypted blob (KMS-managed), never raw
  rotated_from_key_id VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  UNIQUE(tenant_id, key_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_encryption_keys_tenant ON tenant_encryption_keys(tenant_id, status);

-- ----------------------------------------------------------------------------
-- 3. Tenant API credentials (hashed secrets, prefix shown in UI)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  key_prefix VARCHAR(24) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  scopes JSONB DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'active',         -- active | revoked | expired
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, key_prefix)
);
CREATE INDEX IF NOT EXISTS idx_tenant_api_credentials_tenant ON tenant_api_credentials(tenant_id, status);

-- ----------------------------------------------------------------------------
-- 4. Provisioning step checkpoints (idempotent resume + retry)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provisioning_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES tenant_provisioning_jobs(id) ON DELETE CASCADE,
  step_key VARCHAR(80) NOT NULL,
  step_label VARCHAR(150) NOT NULL,
  group_key VARCHAR(60) NOT NULL DEFAULT 'default',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',        -- pending | running | completed | failed | skipped
  attempt INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  detail TEXT,
  output_json JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, step_key)
);
CREATE INDEX IF NOT EXISTS idx_provisioning_steps_job ON provisioning_steps(job_id, sort_order);

-- ----------------------------------------------------------------------------
-- 5. Provisioning job event timeline
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provisioning_job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES tenant_provisioning_jobs(id) ON DELETE CASCADE,
  event_type VARCHAR(60) NOT NULL,
  phase VARCHAR(60),
  message TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',         -- info | warning | error
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provisioning_job_events_job ON provisioning_job_events(job_id, created_at);

-- ----------------------------------------------------------------------------
-- 6. Orchestration columns on tenant_provisioning_jobs
-- ----------------------------------------------------------------------------
ALTER TABLE tenant_provisioning_jobs
  ADD COLUMN IF NOT EXISTS template_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS kind VARCHAR(30) NOT NULL DEFAULT 'provision',   -- provision | clone | upgrade | reprovision
  ADD COLUMN IF NOT EXISTS provisioning_mode VARCHAR(30) NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS phase VARCHAR(60),
  ADD COLUMN IF NOT EXISTS checkpoint_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS inputs_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS output_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_class VARCHAR(60),
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS tenant_number VARCHAR(40),
  ADD COLUMN IF NOT EXISTS actor_id UUID,
  ADD COLUMN IF NOT EXISTS correlation_id UUID;

CREATE INDEX IF NOT EXISTS idx_tenant_provisioning_jobs_status ON tenant_provisioning_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_provisioning_jobs_tenant ON tenant_provisioning_jobs(tenant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 7. Tenant numbering sequences: TEN-<CC>-<YYYY>-<NNNNNN>
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_number_sequences (
  id BIGSERIAL PRIMARY KEY,
  country_code VARCHAR(5) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  UNIQUE(country_code, fiscal_year)
);

CREATE OR REPLACE FUNCTION public.next_tenant_number(p_country_code VARCHAR DEFAULT 'UG')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM NOW());
  v_seq INT;
  v_country VARCHAR(5) := UPPER(COALESCE(NULLIF(TRIM(p_country_code), ''), 'UG'));
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('tenant_number_' || v_country || '_' || v_year));
  INSERT INTO tenant_number_sequences (country_code, fiscal_year, last_number)
  VALUES (v_country, v_year, 1)
  ON CONFLICT (country_code, fiscal_year)
  DO UPDATE SET last_number = tenant_number_sequences.last_number + 1
  RETURNING last_number INTO v_seq;
  IF v_seq IS NULL THEN
    SELECT last_number INTO v_seq
    FROM tenant_number_sequences
    WHERE country_code = v_country AND fiscal_year = v_year;
  END IF;
  RETURN 'TEN-' || v_country || '-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_tenant_number(VARCHAR) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. Row-Level Security - control-plane tables are platform-staff only
-- ----------------------------------------------------------------------------
ALTER TABLE provisioning_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisioning_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisioning_job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_number_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provisioning_templates_select ON provisioning_templates;
CREATE POLICY provisioning_templates_select ON provisioning_templates FOR SELECT
  USING (public.is_platform_admin());
DROP POLICY IF EXISTS provisioning_templates_write ON provisioning_templates;
CREATE POLICY provisioning_templates_write ON provisioning_templates FOR INSERT
  WITH CHECK (public.is_platform_admin());
DROP POLICY IF EXISTS provisioning_templates_update ON provisioning_templates;
CREATE POLICY provisioning_templates_update ON provisioning_templates FOR UPDATE
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS tenant_encryption_keys_select ON tenant_encryption_keys;
CREATE POLICY tenant_encryption_keys_select ON tenant_encryption_keys FOR SELECT
  USING (public.is_platform_admin());
DROP POLICY IF EXISTS tenant_encryption_keys_write ON tenant_encryption_keys;
CREATE POLICY tenant_encryption_keys_write ON tenant_encryption_keys FOR INSERT
  WITH CHECK (public.is_platform_admin());
DROP POLICY IF EXISTS tenant_encryption_keys_update ON tenant_encryption_keys;
CREATE POLICY tenant_encryption_keys_update ON tenant_encryption_keys FOR UPDATE
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS tenant_api_credentials_select ON tenant_api_credentials;
CREATE POLICY tenant_api_credentials_select ON tenant_api_credentials FOR SELECT
  USING (public.is_platform_admin());
DROP POLICY IF EXISTS tenant_api_credentials_write ON tenant_api_credentials;
CREATE POLICY tenant_api_credentials_write ON tenant_api_credentials FOR INSERT
  WITH CHECK (public.is_platform_admin());
DROP POLICY IF EXISTS tenant_api_credentials_update ON tenant_api_credentials;
CREATE POLICY tenant_api_credentials_update ON tenant_api_credentials FOR UPDATE
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
DROP POLICY IF EXISTS tenant_api_credentials_delete ON tenant_api_credentials;
CREATE POLICY tenant_api_credentials_delete ON tenant_api_credentials FOR DELETE
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS provisioning_steps_select ON provisioning_steps;
CREATE POLICY provisioning_steps_select ON provisioning_steps FOR SELECT
  USING (public.is_platform_admin());
DROP POLICY IF EXISTS provisioning_steps_write ON provisioning_steps;
CREATE POLICY provisioning_steps_write ON provisioning_steps FOR INSERT
  WITH CHECK (public.is_platform_admin());
DROP POLICY IF EXISTS provisioning_steps_update ON provisioning_steps;
CREATE POLICY provisioning_steps_update ON provisioning_steps FOR UPDATE
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS provisioning_job_events_select ON provisioning_job_events;
CREATE POLICY provisioning_job_events_select ON provisioning_job_events FOR SELECT
  USING (public.is_platform_admin());
DROP POLICY IF EXISTS provisioning_job_events_write ON provisioning_job_events;
CREATE POLICY provisioning_job_events_write ON provisioning_job_events FOR INSERT
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS tenant_number_sequences_select ON tenant_number_sequences;
CREATE POLICY tenant_number_sequences_select ON tenant_number_sequences FOR SELECT
  USING (public.is_platform_admin());
DROP POLICY IF EXISTS tenant_number_sequences_write ON tenant_number_sequences;
CREATE POLICY tenant_number_sequences_write ON tenant_number_sequences FOR INSERT
  WITH CHECK (public.is_platform_admin());
DROP POLICY IF EXISTS tenant_number_sequences_update ON tenant_number_sequences;
CREATE POLICY tenant_number_sequences_update ON tenant_number_sequences FOR UPDATE
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- ----------------------------------------------------------------------------
-- 9. Seed system templates (tenant templates + industry packs)
-- ----------------------------------------------------------------------------
INSERT INTO provisioning_templates (template_code, name, kind, industry, plan_code, description, is_system, is_active, config)
VALUES
  ('sme-starter', 'SME Starter', 'tenant', NULL, 'starter', 'Core ERP for small teams with 30-day trial', true, true,
   '{"modules":["finance","hr","payroll","crm","inventory","sales","service_desk","projects","ai_assistant"],"security":{"mfa":"optional","password_min_length":10,"session_timeout_min":480},"backup":{"schedule":"daily","retention_days":30,"pitr":false},"ai":{"workspace":true,"agents":["executive","finance"]}}'),
  ('mid-market-professional', 'Mid-Market Professional', 'tenant', NULL, 'professional', 'Multi-company ERP with standard modules and integrations', true, true,
   '{"modules":["finance","hr","payroll","crm","procurement","inventory","manufacturing","assets","fleet","service_desk","projects","recruitment","ai_assistant","sales","dispatch","attendance"],"security":{"mfa":"optional","password_min_length":10,"session_timeout_min":480},"backup":{"schedule":"daily","retention_days":60,"pitr":true},"ai":{"workspace":true,"agents":["executive","finance","crm","inventory"]}}'),
  ('enterprise', 'Enterprise', 'tenant', NULL, 'enterprise', 'Full ERP suite, multi-entity, SSO, custom workflows and AI governance', true, true,
   '{"modules":["finance","hr","payroll","crm","procurement","inventory","manufacturing","assets","fleet","service_desk","projects","recruitment","ai_assistant","sales","dispatch","attendance","warehouse","quality","production","pos","document_management","learning","performance","analytics","workflow","api_gateway"],"security":{"mfa":"enforced","password_min_length":12,"session_timeout_min":240,"sso":true},"backup":{"schedule":"hourly","retention_days":90,"pitr":true},"ai":{"workspace":true,"agents":["executive","finance","procurement","inventory","manufacturing","quality","assets","fleet","hr","payroll","recruitment","crm","projects","service_desk","compliance","risk","security","maintenance"]}}'),
  ('government', 'Government', 'tenant', 'government', 'Public sector - residency, audit, privileged access, high capacity', true, true,
   '{"modules":["finance","hr","payroll","crm","procurement","inventory","assets","fleet","projects","service_desk","recruitment","ai_assistant","compliance","analytics","workflow","document_management"],"security":{"mfa":"enforced","password_min_length":12,"session_timeout_min":120,"sso":true,"audit":"enhanced"},"backup":{"schedule":"hourly","retention_days":365,"pitr":true},"ai":{"workspace":true,"agents":["executive","finance","compliance","risk","security"]},"compliance":["gdpr","iso27001","soc2","local_data_residency"]}'),
  ('private-cloud', 'Private Cloud', 'tenant', NULL, 'enterprise', 'Dedicated environment with regional data residency and SLA 99.95', true, true,
   '{"modules":["finance","hr","payroll","crm","procurement","inventory","manufacturing","assets","fleet","service_desk","projects","recruitment","ai_assistant","analytics","workflow","api_gateway","document_management"],"security":{"mfa":"enforced","password_min_length":12,"session_timeout_min":240,"sso":true},"backup":{"schedule":"hourly","retention_days":365,"pitr":true},"ai":{"workspace":true,"agents":["executive","finance","compliance","risk","security"]},"compliance":["gdpr","iso27001","soc2","local_data_residency"]}'),
  ('trial', '30-Day Trial', 'tenant', NULL, 'starter', 'Trial tenant with limited capacity and guided setup', true, true,
   '{"modules":["finance","hr","payroll","crm","inventory","sales","service_desk","projects","ai_assistant"],"security":{"mfa":"optional","password_min_length":10,"session_timeout_min":480},"backup":{"schedule":"daily","retention_days":14,"pitr":false},"ai":{"workspace":true,"agents":["executive","finance"]}}'),
  -- Industry packs
  ('industry-manufacturing', 'Manufacturing', 'industry', 'manufacturing', NULL, 'Production, BOM, quality, maintenance and shop-floor workflows', true, true,
   '{"modules":["finance","hr","payroll","crm","procurement","inventory","manufacturing","production","quality","maintenance","assets","warehouse","projects","service_desk","ai_assistant","analytics"],"workflows":["purchase_order_approval","goods_receipt","production_order","quality_inspection","maintenance_work_order"],"kpis":["overall_equipment_effectiveness","scrap_rate","downtime"]}'),
  ('industry-healthcare', 'Healthcare', 'industry', 'healthcare', NULL, 'Patient records, facilities, compliance (HIPAA-ready) and scheduling', true, true,
   '{"modules":["finance","hr","payroll","crm","procurement","inventory","assets","projects","service_desk","ai_assistant","compliance"],"workflows":["patient_admission","consent_management","procurement_approval"],"compliance":["hipaa","gdpr"],"kpis":["patient_satisfaction","bed_occupancy"]}'),
  ('industry-retail', 'Retail', 'industry', 'retail', NULL, 'POS, promotions, multi-branch inventory and customer loyalty', true, true,
   '{"modules":["finance","hr","payroll","crm","inventory","sales","pos","warehouse","procurement","ai_assistant"],"workflows":["sales_order","stock_reorder","promotion_approval"],"kpis":["gross_margin","sell_through","basket_size"]}'),
  ('industry-wholesale', 'Wholesale & Distribution', 'industry', 'wholesale', NULL, 'Bulk pricing, distribution, fleet and warehouse workflows', true, true,
   '{"modules":["finance","crm","procurement","inventory","sales","warehouse","fleet","dispatch","assets","ai_assistant"],"workflows":["sales_order","dispatch_plan","stock_reorder"],"kpis":["fill_rate","on_time_delivery"]}'),
  ('industry-education', 'Education', 'industry', 'education', NULL, 'Students, courses, fees, examinations and learning', true, true,
   '{"modules":["finance","hr","payroll","crm","projects","learning","attendance","ai_assistant"],"workflows":["student_enrollment","fee_waiver_approval","examination_result"],"kpis":["enrollment","graduation_rate"]}'),
  ('industry-government', 'Government', 'industry', 'government', NULL, 'Public administration, permits, budgeting and audit', true, true,
   '{"modules":["finance","hr","payroll","crm","procurement","projects","compliance","document_management","analytics","ai_assistant"],"workflows":["budget_approval","permit_issuance","procurement_approval"],"compliance":["government","gdpr","iso27001"],"kpis":["budget_utilisation","service_delivery"]}'),
  ('industry-ngo', 'NGO & Non-Profit', 'industry', 'ngo', NULL, 'Grants, donors, programs, volunteers and impact reporting', true, true,
   '{"modules":["finance","crm","procurement","inventory","projects","hr","payroll","ai_assistant"],"workflows":["grant_approval","donor_receipt","program_budget"],"kpis":["donor_retention","program_efficiency"]}'),
  ('industry-construction', 'Construction', 'industry', 'construction', NULL, 'Projects, contracts, equipment, sites and subcontractors', true, true,
   '{"modules":["finance","crm","procurement","inventory","projects","assets","fleet","hr","payroll","ai_assistant"],"workflows":["contract_approval","site_variation","payment_certificate"],"kpis":["project_margin","safety_incidents"]}'),
  ('industry-agriculture', 'Agriculture', 'industry', 'agriculture', NULL, 'Farms, inputs, harvest, livestock and agronomy', true, true,
   '{"modules":["finance","crm","procurement","inventory","assets","fleet","projects","ai_assistant"],"workflows":["input_request","harvest_batch","quality_inspection"],"kpis":["yield_per_hectare","input_cost"]}'),
  ('industry-hospitality', 'Hospitality', 'industry', 'hospitality', NULL, 'Hotels, restaurants, bookings, POS and housekeeping', true, true,
   '{"modules":["finance","crm","inventory","sales","pos","hr","payroll","assets","ai_assistant"],"workflows":["booking_confirmation","housekeeping_rounds","pos_end_of_day"],"kpis":["occupancy_rate","revpar"]}'),
  ('industry-logistics', 'Logistics', 'industry', 'logistics', NULL, 'Fleet, dispatch, tracking, warehousing and billing', true, true,
   '{"modules":["finance","crm","sales","procurement","inventory","warehouse","fleet","dispatch","assets","maintenance","ai_assistant"],"workflows":["dispatch_plan","trip_closeout","maintenance_work_order"],"kpis":["on_time_delivery","cost_per_km"]}'),
  ('industry-banking', 'Banking', 'industry', 'banking', NULL, 'Branches, KYC, loans, deposits and regulatory reporting', true, true,
   '{"modules":["finance","crm","compliance","document_management","ai_assistant","analytics"],"workflows":["kyc_verification","loan_approval","account_opening"],"compliance":["pci_dss","gdpr"],"kpis":["loan_portfolio","non_performing_loans"]}'),
  ('industry-insurance', 'Insurance', 'industry', 'insurance', NULL, 'Policies, claims, premiums and reinsurance', true, true,
   '{"modules":["finance","crm","compliance","document_management","ai_assistant"],"workflows":["policy_issuance","claim_adjudication","premium_renewal"],"compliance":["gdpr","iso27001"],"kpis":["loss_ratio","claims_cycle_time"]}'),
  ('industry-mining', 'Mining', 'industry', 'mining', NULL, 'Sites, equipment, extraction, safety and maintenance', true, true,
   '{"modules":["finance","hr","payroll","procurement","inventory","assets","maintenance","fleet","compliance","ai_assistant"],"workflows":["maintenance_work_order","permit_issuance","hazard_report"],"kpis":["equipment_availability","safety_incidents"]}'),
  ('industry-energy', 'Energy & Utilities', 'industry', 'energy', NULL, 'Generation, distribution, meters and asset health', true, true,
   '{"modules":["finance","crm","inventory","assets","maintenance","projects","service_desk","ai_assistant"],"workflows":["maintenance_work_order","meter_read","outage_ticket"],"kpis":["asset_health_score","outage_duration"]}'),
  ('industry-utilities', 'Utilities', 'industry', 'utilities', NULL, 'Billing, meters, connections and field service', true, true,
   '{"modules":["finance","crm","inventory","assets","maintenance","service_desk","dispatch","ai_assistant"],"workflows":["meter_read","connection_request","billing_run"],"kpis":["collection_rate","response_time"]}'),
  ('industry-telecom', 'Telecommunications', 'industry', 'telecom', NULL, 'Subscribers, airtime, bundles and network assets', true, true,
   '{"modules":["finance","crm","inventory","assets","maintenance","service_desk","sales","ai_assistant"],"workflows":["subscriber_onboarding","bundle_activation","tower_maintenance"],"kpis":["churn_rate","arpu"]}'),
  ('industry-professional-services', 'Professional Services', 'industry', 'professional-services', NULL, 'Clients, engagements, time tracking and billing', true, true,
   '{"modules":["finance","crm","projects","hr","attendance","inventory","ai_assistant"],"workflows":["engagement_approval","timesheet_approval","client_invoice"],"kpis":["utilisation","billable_hours"]}')
ON CONFLICT (template_code) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  industry = EXCLUDED.industry,
  plan_code = EXCLUDED.plan_code,
  description = EXCLUDED.description,
  config = EXCLUDED.config,
  updated_at = NOW();
