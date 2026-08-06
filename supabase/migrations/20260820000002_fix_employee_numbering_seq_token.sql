-- ============================================================
-- FIX: employee number {SEQ:n} token
-- regexp_matches() returns text[]; assigning into a TEXT variable
-- produced the array-literal text ("{6}") which failed ::INTEGER.
-- substring(regex) returns the capture group directly as TEXT.
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
    v_seq_match := NULLIF(substring(v_number from '\{SEQ:(\d+)\}'), '');
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
