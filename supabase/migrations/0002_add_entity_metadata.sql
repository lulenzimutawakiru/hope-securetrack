-- Entity metadata table (platform‑level definitions)
create table if not exists entity_metadata (
  id uuid primary key default gen_random_uuid(),
  entity text not null unique,
  table_name text not null,
  primary_key_column text not null,
  soft_delete boolean not null default false,
  deleted_column text,
  view_permission text not null,
  create_permission text not null,
  update_permission text not null,
  delete_permission text not null,
  workflow_config jsonb default '{}',
  created_at timestamptz default now()
);

-- Workflow instances table for ad‑hoc workflow execution
create table if not exists workflow_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  company_id uuid,
  workflow_type text not null,
  status text not null default 'pending',
  payload jsonb,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for performance and tenant isolation
create index if not exists idx_workflow_instances_tenant
  on workflow_instances(tenant_id, status);
