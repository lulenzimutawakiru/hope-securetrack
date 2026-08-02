-- Profiles table (linked to Supabase auth.users)
create table if not exists profiles (
  id uuid not null primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  company_id uuid,
  permissions text[] default '{}',
  roles jsonb,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Audit log table
create table if not exists audit_log (
  id bigserial primary key,
  event text not null,
  details jsonb,
  user_id uuid references auth.users(id) on delete set null,
  company_id uuid,
  timestamp timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_audit_log_company on audit_log(company_id, timestamp desc);
create index if not exists idx_profiles_company on profiles(company_id);
