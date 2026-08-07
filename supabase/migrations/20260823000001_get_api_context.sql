-- Performance: single-round-trip API authorization context.
--
-- requireApiAuth previously resolved profile + role + permissions + company +
-- tenant + membership + elevation across 7-8 sequential Supabase round trips
-- on EVERY API request. This RPC returns the same data in one round trip.
--
-- SECURITY INVOKER: row-level security still applies, so every value is
-- scoped to the calling (authenticated) user's tenant/company. The function
-- reads only the caller's own profile (auth.uid()), their role permissions,
-- and the company their profile points at - never another user's data.

CREATE OR REPLACE FUNCTION public.get_api_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile jsonb;
  v_permissions jsonb;
  v_company_id uuid;
  v_tenant_id uuid;
  v_has_access boolean;
  v_elevated boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(up) || jsonb_build_object('role_slug', r.slug)
    INTO v_profile
    FROM user_profiles up
    LEFT JOIN roles r ON r.id = up.role_id
    WHERE up.id = v_uid;

  IF v_profile IS NULL OR v_profile->>'company_id' IS NULL THEN
    RETURN jsonb_build_object(
      'profile', v_profile,
      'permissions', '[]'::jsonb,
      'company_id', NULL::uuid,
      'tenant_id', NULL::uuid,
      'has_access', false,
      'is_elevated', false
    );
  END IF;

  v_company_id := COALESCE(
    (v_profile->>'active_company_id')::uuid,
    (v_profile->>'company_id')::uuid
  );

  SELECT COALESCE(array_agg(p.slug ORDER BY p.slug), ARRAY[]::text[])
    INTO v_permissions
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = (v_profile->>'role_id')::uuid;

  SELECT tenant_id INTO v_tenant_id FROM companies WHERE id = v_company_id;

  SELECT public.user_has_company_access(v_company_id) INTO v_has_access;
  SELECT public.is_platform_elevated() INTO v_elevated;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'permissions', COALESCE(v_permissions, '[]'::jsonb),
    'company_id', v_company_id,
    'tenant_id', COALESCE(v_tenant_id, (v_profile->>'tenant_id')::uuid),
    'has_access', COALESCE(v_has_access, false),
    'is_elevated', COALESCE(v_elevated, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_api_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_api_context() TO service_role;
