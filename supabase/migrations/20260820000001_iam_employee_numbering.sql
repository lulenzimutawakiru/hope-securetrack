-- ============================================================
-- IAM ? EMPLOYEE NUMBERING
-- Tenant/company-scoped, configurable employee ID generation.
-- Supports tokens: {PREFIX} {COMPANY} {BRANCH} {DEPT} {YEAR} {YY} {SEQ} {SEQ:n}
-- Issued numbers are recorded in idm_employee_numbers (unique per company).
-- ============================================================

CREATE TABLE IF NOT EXISTS idm_employee_numbering_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  format VARCHAR(150) NOT NULL DEFAULT 'EMP-{YEAR}-{SEQ}',
  -- EMP-000001 | EMP-UG-{YEAR}-{SEQ} | {BRANCH}-EMP-{YEAR}-{SEQ} | {DEPT}-EMP-{SEQ}
  prefix VARCHAR(20),
  padding INTEGER DEFAULT 5,
  per_year BOOLEAN DEFAULT true,
  next_sequence BIGINT DEFAULT 0,
  last_issued_year INTEGER,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rule_code)
);

CREATE TABLE IF NOT EXISTS idm_employee_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES idm_employee_numbering_rules(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  number VARCHAR(120) NOT NULL,
  seq BIGINT NOT NULL,
  issued_year INTEGER,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, number)
);

CREATE INDEX IF NOT EXISTS idx_emp_numbers_company_seq
  ON idm_employee_numbers(company_id, issued_year, seq);

ALTER TABLE idm_employee_numbering_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE idm_employee_numbers ENABLE ROW LEVEL SECURITY;

-- Reads: company-scoped (same pattern as other IDM tables)
DROP POLICY IF EXISTS idm_employee_numbering_rules_read ON idm_employee_numbering_rules;
CREATE POLICY idm_employee_numbering_rules_read ON idm_employee_numbering_rules FOR SELECT TO authenticated
  USING (company_id = public.user_company_id() OR public.is_super_admin());

DROP POLICY IF EXISTS idm_employee_numbers_read ON idm_employee_numbers;
CREATE POLICY idm_employee_numbers_read ON idm_employee_numbers FOR SELECT TO authenticated
  USING (company_id = public.user_company_id() OR public.is_super_admin());

-- Writes: restricted to IAM administrators (mirrors idm_username_rules)
DROP POLICY IF EXISTS idm_employee_numbering_rules_write_insert ON idm_employee_numbering_rules;
CREATE POLICY idm_employee_numbering_rules_write_insert ON idm_employee_numbering_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));

DROP POLICY IF EXISTS idm_employee_numbering_rules_write_update ON idm_employee_numbering_rules;
CREATE POLICY idm_employee_numbering_rules_write_update ON idm_employee_numbering_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));

DROP POLICY IF EXISTS idm_employee_numbering_rules_write_delete ON idm_employee_numbering_rules;
CREATE POLICY idm_employee_numbering_rules_write_delete ON idm_employee_numbering_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));

DROP POLICY IF EXISTS idm_employee_numbers_write_insert ON idm_employee_numbers;
CREATE POLICY idm_employee_numbers_write_insert ON idm_employee_numbers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));

DROP POLICY IF EXISTS idm_employee_numbers_write_delete ON idm_employee_numbers;
CREATE POLICY idm_employee_numbers_write_delete ON idm_employee_numbers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['iam.manage','iam.provision']));

-- Pad helper for sequence tokens
CREATE OR REPLACE FUNCTION public.pad_sequence(p_seq BIGINT, p_width INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LPAD(GREATEST(p_seq, 0)::TEXT, GREATEST(p_width, 1), '0')
$$;

GRANT EXECUTE ON FUNCTION public.pad_sequence(BIGINT, INTEGER) TO authenticated;

-- ============================================================
-- ATOMIC EMPLOYEE NUMBER ISSUER
-- Locks the rule row, increments the sequence, formats the number,
-- and records the issued number. SECURITY DEFINER so concurrent
-- calls serialise on the rule row lock.
-- ============================================================
CREATE OR REPLACE FUNCTION public.issue_employee_number(
  p_company_id UUID,
  p_rule_id UUID DEFAULT NULL,
  p_branch_code TEXT DEFAULT NULL,
  p_department_code TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_year INTEGER := EXTRACT(YEAR FROM NOW());
  v_seq BIGINT;
  v_number TEXT;
  v_company_code TEXT;
  v_branch_code TEXT;
  v_dept_code TEXT;
  v_padding INTEGER;
  v_prefix TEXT;
  v_seq_match TEXT;
BEGIN
  -- Caller must belong to the target company (or be a platform admin)
  IF NOT (public.is_super_admin() OR public.user_company_id() = p_company_id) THEN
    RAISE EXCEPTION 'Access denied to company %', p_company_id;
  END IF;

  SELECT * INTO v_rule
  FROM idm_employee_numbering_rules
  WHERE company_id = p_company_id
    AND is_active = true
    AND (p_rule_id IS NULL OR id = p_rule_id)
  ORDER BY (p_rule_id IS NOT NULL) DESC, is_default DESC, created_at ASC
  LIMIT 1
  FOR UPDATE;

  -- Fallback (no rule configured): EMP-YYYY-<count+1>
  IF NOT FOUND THEN
    SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
    FROM user_profiles
    WHERE company_id = p_company_id AND deleted_at IS NULL;
    RETURN 'EMP-' || v_year || '-' || public.pad_sequence(v_seq, 5);
  END IF;

  IF v_rule.per_year AND v_rule.last_issued_year IS DISTINCT FROM v_year THEN
    v_seq := 1;
    UPDATE idm_employee_numbering_rules
    SET next_sequence = 0, last_issued_year = v_year, updated_at = NOW()
    WHERE id = v_rule.id;
  ELSE
    v_seq := COALESCE(v_rule.next_sequence, 0) + 1;
    UPDATE idm_employee_numbering_rules
    SET next_sequence = v_seq, last_issued_year = v_year, updated_at = NOW()
    WHERE id = v_rule.id;
  END IF;

  SELECT code INTO v_company_code FROM companies WHERE id = p_company_id;
  v_branch_code := UPPER(NULLIF(p_branch_code, ''));
  v_dept_code := UPPER(NULLIF(p_department_code, ''));

  v_padding := GREATEST(1, COALESCE(v_rule.padding, 5));
  v_prefix := UPPER(COALESCE(NULLIF(v_rule.prefix, ''), v_rule.rule_code));

  v_number := COALESCE(v_rule.format, 'EMP-{YEAR}-{SEQ}');
  v_number := REPLACE(v_number, '{PREFIX}', v_prefix);
  v_number := REPLACE(v_number, '{COMPANY}', COALESCE(UPPER(v_company_code), ''));
  v_number := REPLACE(v_number, '{BRANCH}', COALESCE(v_branch_code, ''));
  v_number := REPLACE(v_number, '{DEPT}', COALESCE(v_dept_code, ''));
  v_number := REPLACE(v_number, '{YEAR}', v_year::TEXT);
  v_number := REPLACE(v_number, '{YY}', RIGHT(v_year::TEXT, 2));

  IF v_number LIKE '%{SEQ:%' THEN
    SELECT regexp_matches(v_number, '\{SEQ:(\d+)\}') INTO v_seq_match;
    IF v_seq_match IS NOT NULL THEN
      v_number := REGEXP_REPLACE(
        v_number,
        '\{SEQ:(\d+)\}',
        public.pad_sequence(v_seq, v_seq_match::INTEGER)
      );
    END IF;
  END IF;
  v_number := REPLACE(v_number, '{SEQ}', public.pad_sequence(v_seq, v_padding));

  INSERT INTO idm_employee_numbers (company_id, rule_id, number, seq, issued_year, created_by)
  VALUES (p_company_id, v_rule.id, v_number, v_seq, v_year, p_actor_id);

  RETURN v_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_employee_number(UUID, UUID, TEXT, TEXT, UUID) TO authenticated;

-- ============================================================
-- SEED: default rule for every company that has none
-- ============================================================
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT id FROM companies ORDER BY created_at
  LOOP
    INSERT INTO idm_employee_numbering_rules (company_id, rule_code, name, description, format, prefix, padding, per_year, is_default)
    VALUES (c.id, 'emp-default', 'Default Employee Numbering',
            'EMP-YYYY-00001 format, resets each year.',
            'EMP-{YEAR}-{SEQ}', 'EMP', 5, true, true)
    ON CONFLICT (company_id, rule_code) DO NOTHING;
  END LOOP;
END $$;
