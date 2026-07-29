-- Hope Design Group — IDM Governance Extension
-- Devices · SSO · API accounts · Temporary access · Activity · Offboarding

-- ============================================================
-- USER DEVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  device_name VARCHAR(150) NOT NULL,
  device_type VARCHAR(40) DEFAULT 'laptop',
  -- laptop | desktop | mobile | tablet | unknown
  os_name VARCHAR(100),
  browser_name VARCHAR(100),
  device_fingerprint VARCHAR(128),
  last_ip VARCHAR(60),
  last_location VARCHAR(150),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  security_status VARCHAR(30) DEFAULT 'trusted',
  -- trusted | unknown | blocked | suspicious
  is_blocked BOOLEAN DEFAULT false,
  blocked_at TIMESTAMPTZ,
  blocked_by UUID REFERENCES user_profiles(id),
  blocked_reason TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idm_devices_user ON idm_devices(user_id, is_blocked);

-- Link sessions to devices optionally
ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES idm_devices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;

-- ============================================================
-- SSO PROVIDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_sso_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider_code VARCHAR(50) NOT NULL,
  -- entra | google | ad | ldap | oauth2 | saml
  name VARCHAR(150) NOT NULL,
  protocol VARCHAR(40) NOT NULL DEFAULT 'oauth2',
  -- oauth2 | saml | ldap | oidc
  client_id VARCHAR(255),
  client_secret_ref VARCHAR(255),
  issuer_url TEXT,
  metadata_url TEXT,
  authorize_url TEXT,
  token_url TEXT,
  userinfo_url TEXT,
  ldap_host VARCHAR(255),
  ldap_base_dn VARCHAR(255),
  default_role_id UUID REFERENCES roles(id),
  auto_provision BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, provider_code)
);

CREATE TABLE IF NOT EXISTS idm_sso_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES idm_sso_providers(id) ON DELETE CASCADE,
  external_subject VARCHAR(255) NOT NULL,
  external_email VARCHAR(255),
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_id, external_subject)
);

-- ============================================================
-- API / SYSTEM ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_api_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  account_purpose VARCHAR(40) DEFAULT 'integration',
  -- integration | application | iot | payment | printer | system
  owner_user_id UUID REFERENCES user_profiles(id),
  role_id UUID REFERENCES roles(id),
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  status VARCHAR(30) DEFAULT 'active',
  -- active | suspended | expired | revoked
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE(company_id, account_code)
);

CREATE TABLE IF NOT EXISTS idm_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  api_account_id UUID NOT NULL REFERENCES idm_api_accounts(id) ON DELETE CASCADE,
  key_prefix VARCHAR(20) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  name VARCHAR(100) DEFAULT 'default',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- ============================================================
-- TEMPORARY ACCESS GRANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_temp_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  grant_number VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  provision_request_id UUID REFERENCES idm_provision_requests(id),
  visitor_name VARCHAR(150),
  visitor_email VARCHAR(255),
  access_type VARCHAR(40) DEFAULT 'contractor',
  -- contractor | auditor | visitor | temporary | guest
  role_id UUID REFERENCES roles(id),
  start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) DEFAULT 'scheduled',
  -- scheduled | active | expired | revoked
  reason TEXT,
  sponsor_user_id UUID REFERENCES user_profiles(id),
  created_by UUID REFERENCES user_profiles(id),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, grant_number)
);

CREATE INDEX IF NOT EXISTS idx_idm_temp_end ON idm_temp_access(end_at, status);

-- ============================================================
-- USER ACTIVITY STREAM (approvals, docs, transactions, actions)
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  activity_type VARCHAR(40) NOT NULL,
  -- action | approval | document | transaction | login | access | module
  module VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  details TEXT,
  entity_type VARCHAR(50),
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(60),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idm_activity_user ON idm_user_activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idm_activity_type ON idm_user_activity(company_id, activity_type, created_at DESC);

-- ============================================================
-- ACCESS REQUESTS (self-service)
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_number VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  request_type VARCHAR(40) DEFAULT 'role',
  -- role | permission | module | mfa | device | password | other
  title VARCHAR(255) NOT NULL,
  description TEXT,
  requested_role_id UUID REFERENCES roles(id),
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | rejected | completed
  reviewed_by UUID REFERENCES user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, request_number)
);

-- ============================================================
-- OFFBOARDING CHECKLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_offboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  offboard_number VARCHAR(50) NOT NULL,
  status VARCHAR(30) DEFAULT 'initiated',
  -- initiated | in_progress | completed
  disable_account BOOLEAN DEFAULT true,
  revoke_sessions BOOLEAN DEFAULT true,
  revoke_devices BOOLEAN DEFAULT true,
  revoke_api_keys BOOLEAN DEFAULT true,
  revoke_roles BOOLEAN DEFAULT true,
  return_assets BOOLEAN DEFAULT false,
  disable_id_card BOOLEAN DEFAULT false,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, offboard_number)
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'idm_devices','idm_sso_providers','idm_sso_links','idm_api_accounts','idm_api_keys',
    'idm_temp_access','idm_user_activity','idm_access_requests','idm_offboarding'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (
         company_id = public.user_company_id() OR public.is_super_admin()
       ) WITH CHECK (
         company_id = public.user_company_id() OR public.is_super_admin()
       )',
      t || '_all', t
    );
  END LOOP;
END $$;

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE cid UUID; uid UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO idm_sso_providers (company_id, provider_code, name, protocol, is_active, auto_provision, config)
  VALUES
    (cid, 'entra', 'Microsoft Entra ID', 'oidc', false, true, '{"tenant":"your-tenant.onmicrosoft.com"}'::jsonb),
    (cid, 'google', 'Google Workspace', 'oauth2', false, true, '{"hd":"hopedesign.ug"}'::jsonb),
    (cid, 'ad', 'Active Directory', 'ldap', false, true, '{"domain":"HDG.LOCAL"}'::jsonb),
    (cid, 'ldap', 'Corporate LDAP', 'ldap', false, false, '{}'::jsonb),
    (cid, 'oauth2', 'Generic OAuth 2.0', 'oauth2', false, true, '{}'::jsonb),
    (cid, 'saml', 'SAML 2.0 IdP', 'saml', false, true, '{}'::jsonb)
  ON CONFLICT (company_id, provider_code) DO NOTHING;

  -- Sample API account
  INSERT INTO idm_api_accounts (company_id, account_code, name, description, account_purpose, status, scopes)
  VALUES
    (cid, 'API-ERP-INTG', 'ERP Integration Hub', 'Service account for iPaaS connectors', 'integration', 'active', ARRAY['intg.api','intg.webhooks']),
    (cid, 'API-IOT-GATE', 'IoT Gateway', 'Industrial sensors and gateways', 'iot', 'active', ARRAY['intg.iot']),
    (cid, 'API-PRINT', 'Label Printer Service', 'Niimbot / industrial printers', 'printer', 'active', ARRAY['printing.create'])
  ON CONFLICT (company_id, account_code) DO NOTHING;

  SELECT id INTO uid FROM user_profiles WHERE company_id = cid ORDER BY created_at LIMIT 1;
  IF uid IS NOT NULL THEN
    INSERT INTO idm_devices (company_id, user_id, device_name, device_type, os_name, browser_name, security_status, last_location)
    SELECT cid, uid, d.name, d.dtype, d.os, d.browser, 'trusted', 'Kampala HQ'
    FROM (VALUES
      ('HDG-LAPTOP-01', 'laptop', 'Windows 11', 'Chrome'),
      ('HDG-PHONE-01', 'mobile', 'Android 14', 'Chrome Mobile')
    ) AS d(name, dtype, os, browser)
    WHERE NOT EXISTS (SELECT 1 FROM idm_devices x WHERE x.user_id = uid AND x.device_name = d.name);

    INSERT INTO idm_user_activity (company_id, user_id, activity_type, module, title, details)
    SELECT cid, uid, a.atype, a.mod, a.title, a.details
    FROM (VALUES
      ('login', 'iam', 'Successful login', 'Desktop session started'),
      ('action', 'identity', 'Viewed user directory', 'Accessed IAM module'),
      ('approval', 'billing', 'Approved invoice', 'HDG-INV sample approval'),
      ('document', 'profiles', 'Opened employee document', 'National ID preview'),
      ('transaction', 'finance', 'Viewed journal entry', 'GL browse')
    ) AS a(atype, mod, title, details)
    WHERE NOT EXISTS (
      SELECT 1 FROM idm_user_activity y WHERE y.user_id = uid AND y.title = a.title LIMIT 1
    );
  END IF;
END $$;
