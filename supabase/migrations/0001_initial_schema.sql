-- Enable pgcrypto extension (provides gen_random_uuid())
create extension if not exists "pgcrypto";

-- Helper to auto-update 'updated_at' column
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Tenant matching helper for row-level security
-- Allows null tenant_id when the JWT claim is also null (platform scope)
-- and bypasses isolation for platform administrators
create or replace function matches_tenant(tenant_id uuid)
returns boolean
language plpgsql
stable
security definer
as $$
declare
  tenant_claim uuid;
begin
  -- Super-admin bypass
  if (auth.jwt() ->> 'app_role') = 'platform_admin' then
    return true;
  end if;

  -- Safely cast JWT claim to UUID; default to null if invalid or missing
  begin
    tenant_claim := (auth.jwt() ->> 'tenant_id')::uuid;
  exception when others then
    tenant_claim := null;
  end;

  -- Allow both to be null (platform-level rows)
  if tenant_id is null and tenant_claim is null then
    return true;
  end if;

  -- Standard tenant equality
  return tenant_id = tenant_claim;
end;
$$;

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

-- Industry templates (platform-level, no per-tenant RLS)
create table if not exists industry_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  default_modules text[] default '{}',
  workflow_templates jsonb default '{}',
  custom_fields jsonb default '{}',
  created_at timestamptz default now()
);

-- Tenants table (each row maps to a tenant organisation)
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry_id uuid references industry_templates(id),
  company_id uuid,
  config jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Which modules are enabled/disabled for a given tenant
create table if not exists tenant_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  module_code text not null,
  enabled boolean not null default false,
  config jsonb default '{}',
  unique(tenant_id, module_code)
);

-- Custom fields defined by each tenant for any entity
create table if not exists custom_fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  entity_type text not null,      -- e.g., 'employee', 'product', 'invoice'
  field_name text not null,
  field_label text not null,
  field_type text not null,       -- 'text', 'number', 'date', 'dropdown', 'checkbox', 'attachment'
  required boolean default false,
  options jsonb default '[]',
  created_at timestamptz default now(),
  unique(tenant_id, entity_type, field_name)
);

-- Workflow definitions that tenants can customise
create table if not exists workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  workflow_type text not null,   -- e.g., 'purchase_order', 'leave_approval'
  name text not null,
  steps jsonb not null,          -- array of {step, approver_role, condition, ...}
  active boolean default true,
  created_at timestamptz default now(),
  unique(tenant_id, workflow_type)
);

-- Tenant-scoped settings (branding, logo, default behaviour)
create table if not exists tenant_settings (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  branding jsonb default '{}',
  modules_enabled text[] default '{}',
  custom_css text,
  updated_at timestamptz default now()
);

-- Indexes for fast tenant-scoped queries
create index if not exists idx_profiles_tenant on profiles(tenant_id);
create index if not exists idx_audit_log_tenant on audit_log(tenant_id, timestamp desc);
create index if not exists idx_profiles_company on profiles(company_id);
create index if not exists idx_audit_log_company on audit_log(company_id, timestamp desc);
create index if not exists idx_tenant_modules_tenant on tenant_modules(tenant_id);
create index if not exists idx_custom_fields_tenant on custom_fields(tenant_id);
create index if not exists idx_workflow_definitions_tenant on workflow_definitions(tenant_id);

-- Trigger for automatic updated_at on profiles
create trigger set_updated_at before update on profiles
  for each row execute function update_updated_at_column();

-- Enable Row-Level Security on all tables
alter table profiles enable row level security;
alter table audit_log enable row level security;
alter table tenants enable row level security;
alter table tenant_modules enable row level security;
alter table custom_fields enable row level security;
alter table workflow_definitions enable row level security;
alter table tenant_settings enable row level security;

-- Drop any pre-existing policies (idempotency)
drop policy if exists "tenant_isolation_profiles" on profiles;
drop policy if exists "tenant_isolation_audit_log" on audit_log;
drop policy if exists "tenant_isolation_tenants" on tenants;
drop policy if exists "tenant_isolation_tenant_modules" on tenant_modules;
drop policy if exists "tenant_isolation_custom_fields" on custom_fields;
drop policy if exists "tenant_isolation_workflow_definitions" on workflow_definitions;
drop policy if exists "tenant_isolation_tenant_settings" on tenant_settings;

-- Tenant isolation policies using the helper function
create policy "tenant_isolation_profiles" on profiles
  for all
  using (matches_tenant(tenant_id))
  with check (matches_tenant(tenant_id));

create policy "tenant_isolation_audit_log" on audit_log
  for all
  using (matches_tenant(tenant_id))
  with check (matches_tenant(tenant_id));

create policy "tenant_isolation_tenants" on tenants
  for all
  using (
    matches_tenant(id)
    or (auth.jwt() ->> 'app_role') = 'platform_admin'
  )
  with check (
    matches_tenant(id)
    or (auth.jwt() ->> 'app_role') = 'platform_admin'
  );

create policy "tenant_isolation_tenant_modules" on tenant_modules
  for all
  using (matches_tenant(tenant_id))
  with check (matches_tenant(tenant_id));

create policy "tenant_isolation_custom_fields" on custom_fields
  for all
  using (matches_tenant(tenant_id))
  with check (matches_tenant(tenant_id));

create policy "tenant_isolation_workflow_definitions" on workflow_definitions
  for all
  using (matches_tenant(tenant_id))
  with check (matches_tenant(tenant_id));

create policy "tenant_isolation_tenant_settings" on tenant_settings
  for all
  using (matches_tenant(tenant_id))
  with check (matches_tenant(tenant_id));
