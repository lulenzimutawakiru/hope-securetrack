-- Hope SecureTrack ERP — Unified Identity & Workforce Ecosystem
-- One digital person → consistent identity across every ERP module
-- UPID (Universal Person ID) is the single source of truth

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE uw_person_status AS ENUM (
  'provisional','active','suspended','leave','terminated','archived'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE uw_link_type AS ENUM (
  'auth_account','employee','workforce_credential','crm_contact','srm_contact',
  'customer_portal','supplier_portal','payroll','service_desk','hopechat',
  'asset_custodian','fleet_driver','contractor','visitor','other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- UNIVERSAL PERSON MASTER
-- ============================================================
CREATE TABLE IF NOT EXISTS uw_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Universal Person ID: HDG-PID-YYYY-######
  upid VARCHAR(40) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  legal_first_name VARCHAR(100),
  legal_last_name VARCHAR(100),
  preferred_name VARCHAR(100),
  photo_url TEXT,
  primary_email VARCHAR(255),
  primary_phone VARCHAR(50),
  -- person kinds (multi-valued via array)
  person_kinds TEXT[] NOT NULL DEFAULT ARRAY['workforce']::TEXT[],
  -- workforce | contractor | visitor | customer | supplier | partner | system | guest
  status uw_person_status NOT NULL DEFAULT 'provisional',
  department VARCHAR(100),
  job_title VARCHAR(150),
  branch_name VARCHAR(150),
  cost_center VARCHAR(80),
  manager_person_id UUID REFERENCES uw_persons(id) ON DELETE SET NULL,
  -- denormalized primary FKs for fast resolution
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  wid_identity_id UUID,
  security_clearance VARCHAR(50) DEFAULT 'standard',
  timezone VARCHAR(60) DEFAULT 'Africa/Kampala',
  locale VARCHAR(20) DEFAULT 'en-UG',
  metadata JSONB DEFAULT '{}'::jsonb,
  activated_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, upid)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uw_persons_user
  ON uw_persons(company_id, user_profile_id) WHERE user_profile_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_uw_persons_employee
  ON uw_persons(company_id, employee_id) WHERE employee_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_uw_persons_status ON uw_persons(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_uw_persons_email ON uw_persons(company_id, primary_email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_uw_persons_search ON uw_persons USING gin (
  to_tsvector('english', coalesce(display_name,'') || ' ' || coalesce(upid,'') || ' ' || coalesce(primary_email,'') || ' ' || coalesce(job_title,''))
);

-- ============================================================
-- MODULE LINKS (person ↔ any ERP entity)
-- ============================================================
CREATE TABLE IF NOT EXISTS uw_person_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES uw_persons(id) ON DELETE CASCADE,
  link_type uw_link_type NOT NULL,
  module_code VARCHAR(50) NOT NULL,
  -- identity | hr | credentials | crm | srm | finance | payroll | production
  -- dispatch | assets | service_desk | hopechat | portal | other
  entity_table VARCHAR(80),
  entity_id UUID,
  entity_code VARCHAR(100),
  is_primary BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active',
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(person_id, link_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_uw_links_person ON uw_person_links(person_id);
CREATE INDEX IF NOT EXISTS idx_uw_links_entity ON uw_person_links(entity_table, entity_id);
CREATE INDEX IF NOT EXISTS idx_uw_links_module ON uw_person_links(company_id, module_code);

-- ============================================================
-- MODULE ENTITLEMENTS (which ERP surfaces this person appears in)
-- ============================================================
CREATE TABLE IF NOT EXISTS uw_module_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES uw_persons(id) ON DELETE CASCADE,
  module_code VARCHAR(50) NOT NULL,
  entitlement VARCHAR(50) NOT NULL DEFAULT 'member',
  -- member | operator | approver | admin | viewer | external
  granted BOOLEAN DEFAULT true,
  source VARCHAR(50) DEFAULT 'role', -- role|manual|provision|sync
  granted_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(person_id, module_code, entitlement)
);

-- ============================================================
-- IDENTITY LIFECYCLE EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS uw_identity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES uw_persons(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  -- created | linked | unlinked | activated | suspended | reactivated
  -- credential_issued | credential_revoked | role_changed | terminated | merged | synced
  title VARCHAR(255) NOT NULL,
  details TEXT,
  module_code VARCHAR(50),
  actor_id UUID REFERENCES user_profiles(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uw_events_person ON uw_identity_events(person_id, occurred_at DESC);

-- ============================================================
-- UPID SEQUENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS uw_upid_sequences (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  prefix VARCHAR(20) NOT NULL DEFAULT 'HDG',
  last_number BIGINT NOT NULL DEFAULT 0,
  pad_width INTEGER NOT NULL DEFAULT 6,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MERGE LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS uw_merge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_person_id UUID NOT NULL,
  target_person_id UUID NOT NULL,
  actor_id UUID REFERENCES user_profiles(id),
  merged_links JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BACK-REFERENCE COLUMNS (optional direct FKs on existing masters)
-- ============================================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS person_id UUID;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS person_id UUID;

-- wid_identities may not have person_id yet
DO $$ BEGIN
  ALTER TABLE wid_identities ADD COLUMN IF NOT EXISTS person_id UUID;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_person ON user_profiles(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_person ON employees(person_id) WHERE person_id IS NOT NULL;

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Unified Identity', 'uw.view', 'unified_identity', 'View unified person directory'),
  ('Manage Unified Identity', 'uw.manage', 'unified_identity', 'Create and link digital persons'),
  ('Unify / Merge Persons', 'uw.merge', 'unified_identity', 'Merge duplicate digital identities'),
  ('Identity Graph Admin', 'uw.admin', 'unified_identity', 'Ecosystem administration')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'uw.%' OR slug LIKE 'iam.%' OR slug LIKE 'profile.%' OR slug LIKE 'wid.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE uw_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE uw_person_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE uw_module_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE uw_identity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE uw_upid_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE uw_merge_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY uw_persons_all ON uw_persons FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY uw_links_all ON uw_person_links FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY uw_ent_all ON uw_module_entitlements FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY uw_events_all ON uw_identity_events FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY uw_seq_all ON uw_upid_sequences FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY uw_merge_all ON uw_merge_log FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- HELPER: next UPID
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_upid(p_company_id UUID, p_prefix TEXT DEFAULT 'HDG')
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  n BIGINT;
  y TEXT := to_char(CURRENT_DATE, 'YYYY');
  pad INT := 6;
BEGIN
  INSERT INTO uw_upid_sequences (company_id, prefix, last_number, pad_width)
  VALUES (p_company_id, p_prefix, 1, pad)
  ON CONFLICT (company_id) DO UPDATE
    SET last_number = uw_upid_sequences.last_number + 1,
        updated_at = NOW()
  RETURNING last_number, pad_width INTO n, pad;

  RETURN p_prefix || '-PID-' || y || '-' || lpad(n::text, pad, '0');
END;
$$;

-- ============================================================
-- SEED / BACKFILL from existing employees + user_profiles
-- ============================================================
DO $$
DECLARE
  cid UUID := 'a0000000-0000-4000-8000-000000000001';
  r RECORD;
  pid UUID;
  upid_val TEXT;
  kinds TEXT[];
BEGIN
  INSERT INTO uw_upid_sequences (company_id, prefix, last_number, pad_width)
  VALUES (cid, 'HDG', 0, 6)
  ON CONFLICT (company_id) DO NOTHING;

  -- Backfill from employees first
  FOR r IN
    SELECT e.* FROM employees e
    WHERE e.company_id = cid
    ORDER BY e.created_at
  LOOP
    IF EXISTS (SELECT 1 FROM uw_persons WHERE company_id = cid AND employee_id = r.id) THEN
      CONTINUE;
    END IF;

    upid_val := public.next_upid(cid, 'HDG');
    kinds := ARRAY['workforce']::TEXT[];

    INSERT INTO uw_persons (
      company_id, upid, display_name, legal_first_name, legal_last_name,
      preferred_name, primary_email, primary_phone, person_kinds, status,
      department, job_title, branch_name, user_profile_id, employee_id,
      activated_at
    ) VALUES (
      cid, upid_val,
      trim(coalesce(r.first_name,'') || ' ' || coalesce(r.last_name,'')),
      r.first_name, r.last_name, r.first_name,
      r.email, r.phone, kinds,
      CASE WHEN r.status::text IN ('active','on_leave') THEN 'active'::uw_person_status
           WHEN r.status::text IN ('terminated') THEN 'terminated'::uw_person_status
           ELSE 'active'::uw_person_status END,
      r.department, r.job_title, NULL, r.user_id, r.id,
      CASE WHEN r.status::text = 'active' THEN NOW() ELSE NULL END
    ) RETURNING id INTO pid;

    UPDATE employees SET person_id = pid WHERE id = r.id;
    IF r.user_id IS NOT NULL THEN
      UPDATE user_profiles SET person_id = pid WHERE id = r.user_id;
      INSERT INTO uw_person_links (company_id, person_id, link_type, module_code, entity_table, entity_id, is_primary)
      VALUES (cid, pid, 'auth_account', 'identity', 'user_profiles', r.user_id, true)
      ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO uw_person_links (company_id, person_id, link_type, module_code, entity_table, entity_id, entity_code, is_primary)
    VALUES (cid, pid, 'employee', 'hr', 'employees', r.id, r.employee_number, true)
    ON CONFLICT DO NOTHING;

    -- Default module entitlements for workforce
    INSERT INTO uw_module_entitlements (company_id, person_id, module_code, entitlement, source) VALUES
      (cid, pid, 'identity', 'member', 'sync'),
      (cid, pid, 'hr', 'member', 'sync'),
      (cid, pid, 'profiles', 'member', 'sync'),
      (cid, pid, 'hopechat', 'member', 'sync'),
      (cid, pid, 'notifications', 'member', 'sync')
    ON CONFLICT DO NOTHING;

    INSERT INTO uw_identity_events (company_id, person_id, event_type, title, details, module_code)
    VALUES (cid, pid, 'created', 'Unified person created from employee', upid_val || ' ← ' || r.employee_number, 'hr');
  END LOOP;

  -- Link wid_identities if table exists
  BEGIN
    FOR r IN
      SELECT w.id, w.employee_id, w.identity_number, w.full_name
      FROM wid_identities w
      WHERE w.company_id = cid AND w.deleted_at IS NULL AND w.employee_id IS NOT NULL
    LOOP
      SELECT id INTO pid FROM uw_persons WHERE company_id = cid AND employee_id = r.employee_id LIMIT 1;
      IF pid IS NOT NULL THEN
        UPDATE uw_persons SET wid_identity_id = r.id WHERE id = pid AND wid_identity_id IS NULL;
        UPDATE wid_identities SET person_id = pid WHERE id = r.id;
        INSERT INTO uw_person_links (company_id, person_id, link_type, module_code, entity_table, entity_id, entity_code, is_primary)
        VALUES (cid, pid, 'workforce_credential', 'credentials', 'wid_identities', r.id, r.identity_number, true)
        ON CONFLICT DO NOTHING;
        INSERT INTO uw_module_entitlements (company_id, person_id, module_code, entitlement, source)
        VALUES (cid, pid, 'credentials', 'member', 'sync')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Orphan user_profiles (no employee) → create person
  FOR r IN
    SELECT up.* FROM user_profiles up
    WHERE up.company_id = cid
      AND COALESCE(up.is_active, true) IS NOT NULL
      AND up.person_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM uw_persons p WHERE p.user_profile_id = up.id)
  LOOP
    upid_val := public.next_upid(cid, 'HDG');
    INSERT INTO uw_persons (
      company_id, upid, display_name, legal_first_name, legal_last_name,
      primary_email, person_kinds, status, user_profile_id, activated_at
    ) VALUES (
      cid, upid_val,
      nullif(trim(coalesce(r.first_name,'') || ' ' || coalesce(r.last_name,'')), ''),
      r.first_name,
      r.last_name,
      r.email,
      ARRAY['workforce']::TEXT[],
      CASE WHEN coalesce(r.is_active, true) THEN 'active'::uw_person_status ELSE 'suspended'::uw_person_status END,
      r.id,
      CASE WHEN coalesce(r.is_active, true) THEN NOW() ELSE NULL END
    ) RETURNING id INTO pid;

    -- ensure display_name never null
    UPDATE uw_persons SET display_name = coalesce(nullif(display_name,''), split_part(coalesce(r.email,''),'@',1), 'User')
    WHERE id = pid;

    UPDATE user_profiles SET person_id = pid WHERE id = r.id;
    INSERT INTO uw_person_links (company_id, person_id, link_type, module_code, entity_table, entity_id, is_primary)
    VALUES (cid, pid, 'auth_account', 'identity', 'user_profiles', r.id, true)
    ON CONFLICT DO NOTHING;
    INSERT INTO uw_module_entitlements (company_id, person_id, module_code, entitlement, source) VALUES
      (cid, pid, 'identity', 'member', 'sync'),
      (cid, pid, 'hopechat', 'member', 'sync')
    ON CONFLICT DO NOTHING;
    INSERT INTO uw_identity_events (company_id, person_id, event_type, title, details, module_code)
    VALUES (cid, pid, 'created', 'Unified person created from auth account', upid_val, 'identity');
  END LOOP;

END $$;

-- ============================================================
-- VIEW: Person 360 resolution surface
-- ============================================================
CREATE OR REPLACE VIEW uw_person_360 AS
SELECT
  p.id,
  p.company_id,
  p.upid,
  p.display_name,
  p.legal_first_name,
  p.legal_last_name,
  p.preferred_name,
  p.photo_url,
  p.primary_email,
  p.primary_phone,
  p.person_kinds,
  p.status,
  p.department,
  p.job_title,
  p.branch_name,
  p.cost_center,
  p.security_clearance,
  p.user_profile_id,
  p.employee_id,
  p.wid_identity_id,
  e.employee_number,
  up.username,
  up.account_status,
  up.is_active AS auth_active,
  (SELECT count(*) FROM uw_person_links l WHERE l.person_id = p.id) AS link_count,
  (SELECT count(*) FROM uw_module_entitlements m WHERE m.person_id = p.id AND m.granted) AS module_count,
  p.activated_at,
  p.created_at,
  p.updated_at
FROM uw_persons p
LEFT JOIN employees e ON e.id = p.employee_id
LEFT JOIN user_profiles up ON up.id = p.user_profile_id
WHERE p.deleted_at IS NULL;
