-- Enable uuid-ossp extension if not already available (Supabase provides it)
create extension if not exists "uuid-ossp";

-- Helper to auto‑update 'updated_at' column
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Profiles table (linked to Supabase auth.users)
create table if not exists profiles (
  id uuid not null primary key references auth.users(id) on delete cascade,
  tenant_id uuid,
  company_id uuid,
  first_name text,
  last_name text,
  email text,
  permissions text[] default '{}',
  roles jsonb,
  avatar_url text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Audit log table
create table if not exists audit_log (
  id bigserial primary key,
  tenant_id uuid,
  company_id uuid,
  event text not null,
  details jsonb,
  user_id uuid references auth.users(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz default now(),
  timestamp timestamptz default now()
);

-- Indexes for fast tenant‑scoped queries
create index if not exists idx_profiles_tenant on profiles(tenant_id);
create index if not exists idx_audit_log_tenant on audit_log(tenant_id, timestamp desc);
create index if not exists idx_profiles_company on profiles(company_id);
create index if not exists idx_audit_log_company on audit_log(company_id, timestamp desc);

-- Trigger for automatic updated_at
create trigger set_updated_at before update on profiles
  for each row execute function update_updated_at_column();

-- Enable Row‑Level Security on both tables
alter table profiles enable row level security;
alter table audit_log enable row level security;

-- Tenant isolation policies
-- Access is restricted to rows where tenant_id matches the JWT claim
create policy "tenant_isolation_profiles" on profiles
  for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation_audit_log" on audit_log
  for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
