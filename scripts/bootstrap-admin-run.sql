INSERT INTO user_profiles (
  id, company_id, role_id, first_name, last_name, email, employee_id, is_active
) VALUES (
  'ac1336ea-c8f4-4b32-b81f-dacb2dd772ba',
  'a0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'Lulenzi',
  'Mutawakiru',
  'lulenzgm2000@gmail.com',
  'EMP-001',
  true
) ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = true;
