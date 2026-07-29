-- Hope Design Group — Enterprise Branding & Corporate Identity / DAM
-- Brands · logos · colors · fonts · guidelines · assets · templates · compliance

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Brand DAM', 'brand.view', 'branding', 'View brand assets and guidelines'),
  ('Manage Brand DAM', 'brand.manage', 'branding', 'Manage brand identity and assets'),
  ('Brand Design', 'brand.design', 'branding', 'Create and edit templates'),
  ('Brand Approve', 'brand.approve', 'branding', 'Approve brand assets and templates'),
  ('Brand Publish', 'brand.publish', 'branding', 'Publish brand guidelines and templates'),
  ('Brand AI', 'brand.ai', 'branding', 'AI brand assistant'),
  ('Brand Assets', 'brand.assets', 'branding', 'Upload and manage digital assets')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug OR p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'brand.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'auditor','sales_manager','hr_manager'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- BRAND PROFILES (multi-company)
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_code VARCHAR(50) NOT NULL,
  brand_name VARCHAR(150) NOT NULL,
  trading_name VARCHAR(150),
  registration_number VARCHAR(80),
  tax_number VARCHAR(80),
  industry VARCHAR(100),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  social_links JSONB DEFAULT '{}'::jsonb,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, brand_code)
);

-- ============================================================
-- LOGOS
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_logos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE CASCADE,
  logo_type VARCHAR(40) NOT NULL DEFAULT 'primary',
  -- primary | secondary | icon | monogram | watermark | dark | light
  name VARCHAR(150) NOT NULL,
  file_url TEXT,
  file_format VARCHAR(20) DEFAULT 'png',
  -- png | svg | pdf | ai | eps
  width_px INTEGER,
  height_px INTEGER,
  min_size_mm DECIMAL(8,2),
  clear_space_note TEXT,
  status VARCHAR(30) DEFAULT 'active',
  -- draft | pending | approved | active | archived | rejected
  version INTEGER DEFAULT 1,
  is_default BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COLOR PALETTE
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE CASCADE,
  color_role VARCHAR(40) NOT NULL DEFAULT 'primary',
  -- primary | secondary | accent | neutral | success | warning | error | custom
  name VARCHAR(100) NOT NULL,
  hex_value VARCHAR(20) NOT NULL,
  rgb_value VARCHAR(40),
  cmyk_value VARCHAR(40),
  pantone VARCHAR(40),
  hsl_value VARCHAR(40),
  usage_rules TEXT,
  contrast_ratio DECIMAL(6,2),
  accessibility_pass BOOLEAN DEFAULT true,
  status VARCHAR(30) DEFAULT 'approved',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TYPOGRAPHY
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_fonts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE CASCADE,
  font_role VARCHAR(40) NOT NULL DEFAULT 'body',
  -- heading | body | digital | print | mono
  family_name VARCHAR(100) NOT NULL,
  fallback_stack TEXT DEFAULT 'system-ui, sans-serif',
  default_size_px INTEGER DEFAULT 14,
  default_weight VARCHAR(30) DEFAULT '400',
  line_spacing DECIMAL(4,2) DEFAULT 1.5,
  usage_guidelines TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GUIDELINES (brand book sections)
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE CASCADE,
  section_code VARCHAR(50) NOT NULL,
  -- logo | color | typography | photography | communication | forbidden
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'published',
  -- draft | review | published | archived
  version INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, section_code, version)
);

-- ============================================================
-- DIGITAL ASSETS (DAM)
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  asset_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  asset_type VARCHAR(40) NOT NULL DEFAULT 'image',
  -- image | logo | product | marketing | photo | document | design | video | other
  file_url TEXT,
  file_name VARCHAR(255),
  file_format VARCHAR(30),
  file_size_bytes INTEGER,
  thumbnail_url TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  status VARCHAR(30) DEFAULT 'active',
  -- draft | pending | approved | active | rejected | archived | expired
  version INTEGER DEFAULT 1,
  expires_on DATE,
  download_count INTEGER DEFAULT 0,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES user_profiles(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, asset_code)
);

CREATE INDEX IF NOT EXISTS idx_brand_assets_type ON brand_assets(company_id, asset_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_brand_assets_tags ON brand_assets USING GIN (tags);

-- ============================================================
-- DOCUMENT / DESIGN TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  template_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'finance',
  -- finance | procurement | hr | sales | production | marketing | security | email | ui
  document_type VARCHAR(50) NOT NULL DEFAULT 'invoice',
  -- invoice | po | quotation | payslip | id_card | label | brochure | email | etc
  canvas_size VARCHAR(40) DEFAULT 'A4',
  -- A4 | Letter | ID | BusinessCard | Label | Poster | Social
  layout_json JSONB DEFAULT '{}'::jsonb,
  html_body TEXT,
  header_html TEXT,
  footer_html TEXT,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | marketing_review | brand_review | management_review | published | rejected | archived
  version INTEGER DEFAULT 1,
  is_default BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, template_code, version)
);

-- ============================================================
-- PRODUCT / PACKAGING BRANDING
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_product_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_code VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  brand_label VARCHAR(150),
  packaging_notes TEXT,
  label_template_id UUID REFERENCES brand_templates(id) ON DELETE SET NULL,
  packaging_template_id UUID REFERENCES brand_templates(id) ON DELETE SET NULL,
  qr_enabled BOOLEAN DEFAULT true,
  security_print BOOLEAN DEFAULT false,
  hologram_zone BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EMAIL SIGNATURES / UI THEMES / BRANCH OVERRIDES
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_email_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  html_body TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_ui_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  theme_name VARCHAR(100) NOT NULL,
  primary_color VARCHAR(20) DEFAULT '#0D7377',
  secondary_color VARCHAR(20) DEFAULT '#1B263B',
  accent_color VARCHAR(20) DEFAULT '#00AEEF',
  font_family VARCHAR(100) DEFAULT 'Inter',
  logo_url TEXT,
  favicon_url TEXT,
  login_tagline TEXT,
  login_background_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_branch_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  branch_name VARCHAR(150) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  logo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- APPROVALS · COMPLIANCE · ANALYTICS
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type VARCHAR(40) NOT NULL,
  -- logo | asset | template | guideline | product
  entity_id UUID NOT NULL,
  stage VARCHAR(40) NOT NULL DEFAULT 'marketing_review',
  -- marketing_review | brand_review | management_review | published | rejected
  status VARCHAR(30) DEFAULT 'pending',
  reviewer_id UUID REFERENCES user_profiles(id),
  comments TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS brand_compliance_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  issue_type VARCHAR(50) NOT NULL,
  -- wrong_logo | wrong_color | outdated_template | missing_legal | unauthorized
  title VARCHAR(255) NOT NULL,
  description TEXT,
  entity_type VARCHAR(40),
  entity_id UUID,
  severity VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(30) DEFAULT 'open',
  detected_by VARCHAR(40) DEFAULT 'system',
  -- system | ai | user
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS brand_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(40),
  entity_id UUID,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brand_profiles','brand_logos','brand_colors','brand_fonts','brand_guidelines',
    'brand_assets','brand_templates','brand_product_profiles','brand_email_signatures',
    'brand_ui_themes','brand_branch_overrides','brand_approvals','brand_compliance_issues','brand_audit'
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
-- SEED — Hope Design Group
-- ============================================================
DO $$
DECLARE
  cid UUID;
  bid UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO brand_profiles (
    company_id, brand_code, brand_name, trading_name, industry, email, website,
    phone, address, is_primary, is_active, social_links
  ) VALUES (
    cid, 'HDG-PRIMARY', 'Hope Design Group Ltd', 'Hope Paper / Hope SecureTrack',
    'Security Printing & Manufacturing',
    'info@hopedesign.ug', 'https://hopedesign.ug', '+256700000000',
    'Kampala, Uganda', true, true,
    '{"linkedin":"hopedesign","x":"hopedesign"}'::jsonb
  )
  ON CONFLICT (company_id, brand_code) DO NOTHING;

  SELECT id INTO bid FROM brand_profiles WHERE company_id = cid AND brand_code = 'HDG-PRIMARY';

  INSERT INTO brand_logos (company_id, brand_id, logo_type, name, file_format, status, is_default, version)
  VALUES
    (cid, bid, 'primary', 'HDG Primary Logo', 'svg', 'active', true, 1),
    (cid, bid, 'icon', 'HDG Icon / App Mark', 'png', 'active', false, 1),
    (cid, bid, 'dark', 'HDG Dark Mode Logo', 'svg', 'active', false, 1),
    (cid, bid, 'light', 'HDG Light Mode Logo', 'svg', 'active', false, 1),
    (cid, bid, 'watermark', 'HDG Watermark', 'png', 'active', false, 1)
  ON CONFLICT DO NOTHING;

  INSERT INTO brand_colors (company_id, brand_id, color_role, name, hex_value, rgb_value, cmyk_value, pantone, usage_rules, accessibility_pass, sort_order)
  VALUES
    (cid, bid, 'primary', 'Hope Teal', '#0D7377', '13,115,119', '89,3,0,53', '321 C', 'Primary brand actions and headers', true, 1),
    (cid, bid, 'secondary', 'Hope Navy', '#1B263B', '27,38,59', '54,36,0,77', '433 C', 'Secondary panels and navigation', true, 2),
    (cid, bid, 'accent', 'Hope Sky', '#00AEEF', '0,174,239', '100,27,0,6', '2995 C', 'Highlights and CTAs', true, 3),
    (cid, bid, 'neutral', 'White', '#FFFFFF', '255,255,255', '0,0,0,0', NULL, 'Backgrounds and reverse logos', true, 4),
    (cid, bid, 'neutral', 'Charcoal', '#1A1A1A', '26,26,26', '0,0,0,90', NULL, 'Body text', true, 5)
  ON CONFLICT DO NOTHING;

  INSERT INTO brand_fonts (company_id, brand_id, font_role, family_name, fallback_stack, default_size_px, default_weight, line_spacing, usage_guidelines)
  VALUES
    (cid, bid, 'heading', 'Inter', 'Inter, system-ui, sans-serif', 24, '600', 1.25, 'Headings and titles'),
    (cid, bid, 'body', 'Inter', 'Inter, system-ui, sans-serif', 14, '400', 1.5, 'Body copy and ERP UI'),
    (cid, bid, 'print', 'Inter', 'Inter, Arial, Helvetica, sans-serif', 11, '400', 1.4, 'Print documents and invoices'),
    (cid, bid, 'mono', 'JetBrains Mono', 'ui-monospace, monospace', 12, '400', 1.4, 'Codes, serials, batch numbers')
  ON CONFLICT DO NOTHING;

  INSERT INTO brand_guidelines (company_id, brand_id, section_code, title, body, status, version, sort_order, published_at)
  VALUES
    (cid, bid, 'logo', 'Logo Guidelines',
     E'## Logo usage\n\n- Use primary logo on white or light backgrounds.\n- Maintain clear space equal to the height of the icon mark.\n- Minimum digital width: 120px.\n- Do not stretch, recolor, or add effects.\n- Dark logo on dark UI; light logo on dark photography.',
     'published', 1, 1, NOW()),
    (cid, bid, 'color', 'Color Guidelines',
     E'## Colors\n\n- Primary teal (#0D7377) for primary actions.\n- Navy (#1B263B) for navigation.\n- Accent sky (#00AEEF) sparingly for highlights.\n- Ensure WCAG AA contrast for text.',
     'published', 1, 2, NOW()),
    (cid, bid, 'typography', 'Typography Rules',
     E'## Type\n\n- Headings: Inter 600.\n- Body: Inter 400, 14px digital / 11pt print.\n- Line spacing 1.5 for body.\n- Use mono for product codes and batch numbers.',
     'published', 1, 3, NOW()),
    (cid, bid, 'photography', 'Photography Style',
     E'## Imagery\n\n- Clean industrial and paper manufacturing scenes.\n- Natural light preferred.\n- Avoid cluttered backgrounds on product shots.',
     'published', 1, 4, NOW()),
    (cid, bid, 'communication', 'Communication Style',
     E'## Voice\n\n- Professional, secure, African enterprise tone.\n- Prefer plain language over jargon.\n- Always include legal entity name on formal documents.',
     'published', 1, 5, NOW()),
    (cid, bid, 'forbidden', 'Forbidden Usage',
     E'## Do not\n\n- Use outdated logos.\n- Place logo on busy patterns without contrast.\n- Alter brand colors outside approved palette.\n- Use unapproved templates for customer-facing docs.',
     'published', 1, 6, NOW())
  ON CONFLICT DO NOTHING;

  INSERT INTO brand_assets (company_id, brand_id, asset_code, title, asset_type, file_format, tags, status, version)
  VALUES
    (cid, bid, 'AST-LOGO-01', 'Primary Logo Pack', 'logo', 'zip', ARRAY['logo','svg','png'], 'active', 1),
    (cid, bid, 'AST-PPR-A4', 'Premium A4 Product Shot', 'product', 'jpg', ARRAY['paper','a4','product'], 'active', 1),
    (cid, bid, 'AST-PKG-BOX', 'Carton Box Artwork', 'marketing', 'pdf', ARRAY['packaging','box'], 'active', 1),
    (cid, bid, 'AST-BRO-01', 'Corporate Brochure', 'document', 'pdf', ARRAY['brochure','sales'], 'active', 1),
    (cid, bid, 'AST-SEC-BG', 'Security Background Pattern', 'design', 'png', ARRAY['security','print'], 'active', 1)
  ON CONFLICT (company_id, asset_code) DO NOTHING;

  INSERT INTO brand_templates (
    company_id, brand_id, template_code, name, category, document_type, canvas_size,
    header_html, footer_html, html_body, status, version, is_default, published_at
  ) VALUES
    (cid, bid, 'TPL-INV-01', 'Standard Tax Invoice', 'finance', 'invoice', 'A4',
     '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0D7377;padding-bottom:8px"><div><strong style="color:#0D7377;font-size:18px">Hope Design Group Ltd</strong><br/><span style="font-size:11px;color:#555">Tax Invoice</span></div><div style="font-size:11px;text-align:right">{{company_address}}<br/>{{company_phone}}</div></div>',
     '<div style="border-top:1px solid #ddd;padding-top:8px;font-size:10px;color:#666;text-align:center">{{company_email}} · {{company_website}} · TIN {{tax_number}}</div>',
     '<p>Bill to: {{customer_name}}</p><table width="100%" style="border-collapse:collapse;font-size:12px">{{line_items}}</table><p style="text-align:right"><strong>Total: {{total}}</strong></p>',
     'published', 1, true, NOW()),
    (cid, bid, 'TPL-PO-01', 'Purchase Order', 'procurement', 'purchase_order', 'A4',
     '<div style="color:#0D7377;font-weight:700;font-size:18px">Purchase Order</div>',
     '<div style="font-size:10px">Hope Design Group Ltd — Confidential</div>',
     '<p>Supplier: {{supplier_name}}</p><p>PO #: {{po_number}}</p>',
     'published', 1, true, NOW()),
    (cid, bid, 'TPL-QT-01', 'Sales Quotation', 'sales', 'quotation', 'A4',
     '<div style="color:#1B263B;font-weight:700">Quotation</div>',
     '<div style="font-size:10px">Valid for 30 days</div>',
     '<p>Quote for: {{customer_name}}</p>',
     'published', 1, true, NOW()),
    (cid, bid, 'TPL-LBL-A4', 'A4 Ream Label', 'production', 'label', 'Label',
     '', '',
     '<div style="border:1px solid #0D7377;padding:8px;font-family:Inter,sans-serif"><strong>Hope Paper</strong><br/>Premium A4 · {{gsm}}gsm<br/>Batch {{batch}} · QR {{qr}}</div>',
     'published', 1, true, NOW()),
    (cid, bid, 'TPL-EMAIL-01', 'Corporate Email Signature', 'email', 'email', 'Social',
     '', '',
     '<p style="font-family:Inter,sans-serif;font-size:13px">Regards,<br/><strong>{{name}}</strong><br/>{{title}}<br/><span style="color:#0D7377">Hope Design Group Ltd</span><br/><a href="https://hopedesign.ug">hopedesign.ug</a></p>',
     'published', 1, true, NOW())
  ON CONFLICT DO NOTHING;

  INSERT INTO brand_email_signatures (company_id, brand_id, name, html_body, is_default, status)
  VALUES (
    cid, bid, 'Default Staff Signature',
    '<p style="font-family:Inter,sans-serif;font-size:13px;color:#1A1A1A">Regards,<br/><strong>{{full_name}}</strong><br/>{{job_title}}<br/><span style="color:#0D7377;font-weight:600">Hope Design Group Ltd</span><br/>{{phone}} · <a href="https://hopedesign.ug" style="color:#00AEEF">hopedesign.ug</a></p>',
    true, 'active'
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO brand_ui_themes (
    company_id, brand_id, theme_name, primary_color, secondary_color, accent_color,
    font_family, login_tagline, is_active
  ) VALUES (
    cid, bid, 'Hope SecureTrack Default', '#0D7377', '#1B263B', '#00AEEF',
    'Inter', 'Enterprise security printing ERP', true
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO brand_product_profiles (
    company_id, brand_id, product_code, product_name, brand_label, qr_enabled, security_print, status
  )
  SELECT cid, bid, p.product_code, p.name, 'Hope Paper', true, true, 'active'
  FROM products p
  WHERE p.company_id = cid
  AND NOT EXISTS (
    SELECT 1 FROM brand_product_profiles b WHERE b.company_id = cid AND b.product_code = p.product_code
  )
  LIMIT 5;

  INSERT INTO brand_compliance_issues (company_id, issue_type, title, description, severity, status, detected_by)
  SELECT cid, 'outdated_template', 'Review legacy invoice templates',
    'Ensure all finance docs use TPL-INV-01 brand colors.', 'low', 'open', 'system'
  WHERE NOT EXISTS (
    SELECT 1 FROM brand_compliance_issues c WHERE c.company_id = cid AND c.issue_type = 'outdated_template'
  );

END $$;
