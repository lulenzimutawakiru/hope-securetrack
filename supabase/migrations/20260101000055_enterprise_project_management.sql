-- Hope SecureTrack ERP — Enterprise Project Portfolio Management (PPM)
-- Lifecycle: request → business case → plan → execute → monitor → bill → close
-- Manufacturing · Customer · ICT · Construction · R&D · CAPEX · Secure Printing

-- ============================================================
-- PORTFOLIOS & PROGRAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_name VARCHAR(200),
  strategic_theme VARCHAR(150),
  budget_total DECIMAL(18,2) DEFAULT 0,
  budget_allocated DECIMAL(18,2) DEFAULT 0,
  health_score DECIMAL(5,2) DEFAULT 80,
  priority INTEGER DEFAULT 5,
  status VARCHAR(30) DEFAULT 'active',
  currency_code VARCHAR(10) DEFAULT 'UGX',
  notes TEXT,
  version_no INTEGER DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, portfolio_code)
);

CREATE TABLE IF NOT EXISTS ppm_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES ppm_portfolios(id) ON DELETE SET NULL,
  program_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sponsor_name VARCHAR(200),
  manager_name VARCHAR(200),
  start_date DATE,
  end_date DATE,
  budget DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  health_score DECIMAL(5,2) DEFAULT 80,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, program_code)
);

CREATE TABLE IF NOT EXISTS ppm_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS ppm_project_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  -- manufacturing | customer | ict | construction | internal | rd | maintenance | capex | government | secure_print
  description TEXT,
  default_methodology VARCHAR(40) DEFAULT 'hybrid',
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS ppm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  project_type VARCHAR(60) DEFAULT 'internal',
  methodology VARCHAR(40) DEFAULT 'waterfall',
  description TEXT,
  default_duration_days INTEGER DEFAULT 90,
  wbs_json JSONB DEFAULT '[]'::jsonb,
  tasks_json JSONB DEFAULT '[]'::jsonb,
  milestones_json JSONB DEFAULT '[]'::jsonb,
  budget_template DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, template_code)
);

-- ============================================================
-- REQUESTS & BUSINESS CASES
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_project_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  requestor_name VARCHAR(200),
  department_name VARCHAR(150),
  business_need TEXT,
  estimated_budget DECIMAL(18,2) DEFAULT 0,
  expected_benefits TEXT,
  priority VARCHAR(20) DEFAULT 'normal',
  sponsor_name VARCHAR(200),
  project_type VARCHAR(60) DEFAULT 'internal',
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | submitted | under_review | approved | rejected | converted | withdrawn | archived
  converted_project_id UUID,
  attachments_json JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, request_number)
);

CREATE TABLE IF NOT EXISTS ppm_business_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  case_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  request_id UUID REFERENCES ppm_project_requests(id) ON DELETE SET NULL,
  strategic_objectives TEXT,
  financial_analysis TEXT,
  roi_pct DECIMAL(8,2) DEFAULT 0,
  npv DECIMAL(18,2) DEFAULT 0,
  irr_pct DECIMAL(8,2) DEFAULT 0,
  cost_benefit TEXT,
  risk_assessment TEXT,
  swot_analysis TEXT,
  funding_source VARCHAR(150),
  total_investment DECIMAL(18,2) DEFAULT 0,
  expected_return DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | submitted | approved | rejected | archived
  file_url TEXT,
  notes TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, case_number)
);

-- ============================================================
-- PROJECTS (CORE)
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  portfolio_id UUID REFERENCES ppm_portfolios(id) ON DELETE SET NULL,
  program_id UUID REFERENCES ppm_programs(id) ON DELETE SET NULL,
  portfolio_name VARCHAR(200),
  program_name VARCHAR(200),
  category_name VARCHAR(100),
  project_type VARCHAR(60) DEFAULT 'internal',
  methodology VARCHAR(40) DEFAULT 'hybrid',
  -- waterfall | agile | hybrid | kanban
  lifecycle_stage VARCHAR(40) DEFAULT 'initiation',
  -- initiation | planning | execution | monitoring | billing | closure | closed
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | active | on_hold | delayed | completed | cancelled | closed
  health VARCHAR(20) DEFAULT 'green',
  -- green | amber | red
  manager_name VARCHAR(200),
  sponsor_name VARCHAR(200),
  customer_name VARCHAR(200),
  branch_name VARCHAR(150),
  department_name VARCHAR(150),
  start_date DATE,
  end_date DATE,
  baseline_start DATE,
  baseline_end DATE,
  actual_start DATE,
  actual_end DATE,
  percent_complete DECIMAL(5,2) DEFAULT 0,
  budget_planned DECIMAL(18,2) DEFAULT 0,
  budget_actual DECIMAL(18,2) DEFAULT 0,
  budget_forecast DECIMAL(18,2) DEFAULT 0,
  planned_value DECIMAL(18,2) DEFAULT 0,
  earned_value DECIMAL(18,2) DEFAULT 0,
  actual_cost DECIMAL(18,2) DEFAULT 0,
  spi DECIMAL(8,4) DEFAULT 1,
  cpi DECIMAL(8,4) DEFAULT 1,
  currency_code VARCHAR(10) DEFAULT 'UGX',
  billing_method VARCHAR(40) DEFAULT 'fixed_price',
  -- fixed_price | t_and_m | milestone | progress | retention | recurring
  template_id UUID REFERENCES ppm_templates(id) ON DELETE SET NULL,
  request_id UUID REFERENCES ppm_project_requests(id) ON DELETE SET NULL,
  sales_order_ref VARCHAR(80),
  contract_ref VARCHAR(80),
  opportunity_ref VARCHAR(80),
  qr_payload TEXT,
  notes TEXT,
  version_no INTEGER DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, project_code)
);

CREATE INDEX IF NOT EXISTS idx_ppm_projects_status ON ppm_projects(company_id, status) WHERE deleted_at IS NULL;

-- ============================================================
-- WBS / TASKS / MILESTONES / DELIVERABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_wbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  parent_id UUID,
  wbs_code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  node_type VARCHAR(40) DEFAULT 'phase',
  -- phase | deliverable | work_package | task | milestone | closure
  sort_order INTEGER DEFAULT 0,
  percent_complete DECIMAL(5,2) DEFAULT 0,
  planned_start DATE,
  planned_end DATE,
  status VARCHAR(30) DEFAULT 'open',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ppm_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  milestone_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  completed_date DATE,
  percent_complete DECIMAL(5,2) DEFAULT 0,
  is_billing BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | achieved | missed | cancelled
  owner_name VARCHAR(200),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, milestone_code)
);

CREATE TABLE IF NOT EXISTS ppm_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  deliverable_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  acceptance_criteria TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | in_progress | delivered | accepted | rejected
  owner_name VARCHAR(200),
  file_url TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, deliverable_code)
);

CREATE TABLE IF NOT EXISTS ppm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  wbs_id UUID REFERENCES ppm_wbs(id) ON DELETE SET NULL,
  parent_task_id UUID,
  task_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  assignee_name VARCHAR(200),
  reviewer_name VARCHAR(200),
  approver_name VARCHAR(200),
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(30) DEFAULT 'todo',
  -- todo | in_progress | blocked | in_review | done | cancelled
  estimated_hours DECIMAL(10,2) DEFAULT 0,
  actual_hours DECIMAL(10,2) DEFAULT 0,
  cost DECIMAL(18,2) DEFAULT 0,
  start_date DATE,
  due_date DATE,
  finish_date DATE,
  percent_complete DECIMAL(5,2) DEFAULT 0,
  sprint_name VARCHAR(100),
  board_column VARCHAR(40) DEFAULT 'todo',
  dependency_codes TEXT,
  qr_payload TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, task_code)
);

CREATE INDEX IF NOT EXISTS idx_ppm_tasks_project ON ppm_tasks(company_id, project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ppm_tasks_status ON ppm_tasks(company_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ppm_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES ppm_tasks(id) ON DELETE CASCADE,
  item_text VARCHAR(500) NOT NULL,
  is_done BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ppm_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  predecessor_task_code VARCHAR(50) NOT NULL,
  successor_task_code VARCHAR(50) NOT NULL,
  dependency_type VARCHAR(20) DEFAULT 'FS',
  -- FS | SS | FF | SF
  lag_days INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AGILE
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  sprint_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  goal TEXT,
  start_date DATE,
  end_date DATE,
  capacity_hours DECIMAL(10,2) DEFAULT 0,
  committed_points INTEGER DEFAULT 0,
  completed_points INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'planned',
  -- planned | active | completed | cancelled
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, sprint_code)
);

CREATE TABLE IF NOT EXISTS ppm_backlog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  item_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  item_type VARCHAR(40) DEFAULT 'story',
  -- epic | story | bug | spike | task
  priority VARCHAR(20) DEFAULT 'normal',
  story_points INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'backlog',
  -- backlog | ready | sprint | done | cancelled
  sprint_name VARCHAR(100),
  assignee_name VARCHAR(200),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, item_code)
);

CREATE TABLE IF NOT EXISTS ppm_roadmap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  item_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  quarter VARCHAR(20),
  target_date DATE,
  status VARCHAR(30) DEFAULT 'planned',
  theme VARCHAR(100),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, item_code)
);

-- ============================================================
-- RESOURCES & TIME
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  resource_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  resource_type VARCHAR(40) DEFAULT 'employee',
  -- employee | contractor | consultant | machine | vehicle | room | equipment
  skills TEXT,
  certifications TEXT,
  capacity_hours_week DECIMAL(8,2) DEFAULT 40,
  cost_rate DECIMAL(14,2) DEFAULT 0,
  bill_rate DECIMAL(14,2) DEFAULT 0,
  availability_pct DECIMAL(5,2) DEFAULT 100,
  employee_id UUID,
  status VARCHAR(30) DEFAULT 'available',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, resource_code)
);

CREATE TABLE IF NOT EXISTS ppm_resource_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  allocation_code VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  resource_id UUID REFERENCES ppm_resources(id) ON DELETE SET NULL,
  resource_name VARCHAR(200),
  role_name VARCHAR(100),
  allocation_pct DECIMAL(5,2) DEFAULT 100,
  hours_planned DECIMAL(10,2) DEFAULT 0,
  hours_actual DECIMAL(10,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, allocation_code)
);

CREATE TABLE IF NOT EXISTS ppm_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  timesheet_number VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE SET NULL,
  project_code VARCHAR(50),
  task_id UUID REFERENCES ppm_tasks(id) ON DELETE SET NULL,
  task_code VARCHAR(50),
  resource_name VARCHAR(200),
  work_date DATE DEFAULT CURRENT_DATE,
  hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  billable BOOLEAN DEFAULT true,
  cost_amount DECIMAL(18,2) DEFAULT 0,
  bill_amount DECIMAL(18,2) DEFAULT 0,
  description TEXT,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | submitted | approved | rejected | posted
  entry_method VARCHAR(40) DEFAULT 'manual',
  -- manual | timer | mobile | qr | gps | biometric
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, timesheet_number)
);

CREATE TABLE IF NOT EXISTS ppm_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  task_code VARCHAR(50),
  resource_name VARCHAR(200),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FINANCE / BUDGET / BILLING
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  budget_code VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  cost_center VARCHAR(80),
  category VARCHAR(80) DEFAULT 'labor',
  -- labor | materials | equipment | services | overhead | contingency | other
  planned_amount DECIMAL(18,2) DEFAULT 0,
  committed_amount DECIMAL(18,2) DEFAULT 0,
  actual_amount DECIMAL(18,2) DEFAULT 0,
  forecast_amount DECIMAL(18,2) DEFAULT 0,
  currency_code VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, budget_code)
);

CREATE TABLE IF NOT EXISTS ppm_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  expense_number VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE SET NULL,
  project_code VARCHAR(50),
  claimant_name VARCHAR(200),
  expense_date DATE DEFAULT CURRENT_DATE,
  category VARCHAR(80) DEFAULT 'travel',
  amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  currency_code VARCHAR(10) DEFAULT 'UGX',
  description TEXT,
  receipt_url TEXT,
  status VARCHAR(30) DEFAULT 'submitted',
  -- draft | submitted | approved | rejected | reimbursed | posted
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, expense_number)
);

CREATE TABLE IF NOT EXISTS ppm_purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pr_number VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE SET NULL,
  project_code VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  item_description TEXT,
  quantity DECIMAL(14,3) DEFAULT 1,
  estimated_cost DECIMAL(18,2) DEFAULT 0,
  needed_by DATE,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | submitted | approved | ordered | received | cancelled
  notes TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, pr_number)
);

CREATE TABLE IF NOT EXISTS ppm_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE SET NULL,
  project_code VARCHAR(50),
  customer_name VARCHAR(200),
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  billing_method VARCHAR(40) DEFAULT 'milestone',
  amount DECIMAL(18,2) DEFAULT 0,
  tax_amount DECIMAL(18,2) DEFAULT 0,
  retention_amount DECIMAL(18,2) DEFAULT 0,
  net_amount DECIMAL(18,2) DEFAULT 0,
  currency_code VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | issued | paid | partial | overdue | cancelled
  milestone_name VARCHAR(200),
  notes TEXT,
  finance_posted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS ppm_progress_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  claim_number VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE SET NULL,
  project_code VARCHAR(50),
  period_label VARCHAR(60),
  claim_date DATE DEFAULT CURRENT_DATE,
  percent_complete DECIMAL(5,2) DEFAULT 0,
  claimed_amount DECIMAL(18,2) DEFAULT 0,
  certified_amount DECIMAL(18,2) DEFAULT 0,
  retention_pct DECIMAL(5,2) DEFAULT 10,
  retention_amount DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | submitted | certified | paid | disputed
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, claim_number)
);

CREATE TABLE IF NOT EXISTS ppm_retentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  retention_code VARCHAR(50) NOT NULL,
  project_code VARCHAR(50),
  claim_number VARCHAR(50),
  amount DECIMAL(18,2) DEFAULT 0,
  release_date DATE,
  status VARCHAR(30) DEFAULT 'held',
  -- held | released | partial
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, retention_code)
);

CREATE TABLE IF NOT EXISTS ppm_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  revenue_code VARCHAR(50) NOT NULL,
  project_code VARCHAR(50),
  recognition_date DATE DEFAULT CURRENT_DATE,
  method VARCHAR(40) DEFAULT 'percent_complete',
  amount DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'recognized',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, revenue_code)
);

-- ============================================================
-- DOCS / CHANGE / RISK / ISSUES / QUALITY
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  doc_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  doc_type VARCHAR(60) DEFAULT 'general',
  -- contract | drawing | boq | specification | photo | video | inspection | change_order | minutes | certificate | other
  version_label VARCHAR(40) DEFAULT '1.0',
  file_url TEXT,
  status VARCHAR(30) DEFAULT 'active',
  signed BOOLEAN DEFAULT false,
  qr_payload TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, doc_code)
);

CREATE TABLE IF NOT EXISTS ppm_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  change_number VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  change_type VARCHAR(40) DEFAULT 'scope',
  -- scope | budget | schedule | resource
  description TEXT,
  impact_analysis TEXT,
  cost_impact DECIMAL(18,2) DEFAULT 0,
  schedule_impact_days INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'submitted',
  -- submitted | impact_analysis | approved | rejected | implemented | closed
  requester_name VARCHAR(200),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, change_number)
);

CREATE TABLE IF NOT EXISTS ppm_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  risk_code VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  probability VARCHAR(20) DEFAULT 'medium',
  impact VARCHAR(20) DEFAULT 'medium',
  risk_score INTEGER DEFAULT 9,
  mitigation TEXT,
  owner_name VARCHAR(200),
  status VARCHAR(30) DEFAULT 'open',
  -- open | mitigating | closed | accepted
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, risk_code)
);

CREATE TABLE IF NOT EXISTS ppm_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  issue_code VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'medium',
  root_cause TEXT,
  resolution TEXT,
  escalation_level VARCHAR(40) DEFAULT 'project',
  owner_name VARCHAR(200),
  status VARCHAR(30) DEFAULT 'open',
  -- open | in_progress | escalated | resolved | closed
  raised_date DATE DEFAULT CURRENT_DATE,
  closed_date DATE,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, issue_code)
);

CREATE TABLE IF NOT EXISTS ppm_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  decision_code VARCHAR(50) NOT NULL,
  project_code VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  decision_text TEXT,
  decision_date DATE DEFAULT CURRENT_DATE,
  decided_by VARCHAR(200),
  status VARCHAR(30) DEFAULT 'recorded',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, decision_code)
);

CREATE TABLE IF NOT EXISTS ppm_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lesson_code VARCHAR(50) NOT NULL,
  project_code VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(80) DEFAULT 'general',
  what_went_well TEXT,
  what_to_improve TEXT,
  recommendation TEXT,
  status VARCHAR(30) DEFAULT 'draft',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, lesson_code)
);

CREATE TABLE IF NOT EXISTS ppm_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  meeting_code VARCHAR(50) NOT NULL,
  project_code VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  meeting_date TIMESTAMPTZ DEFAULT NOW(),
  attendees TEXT,
  agenda TEXT,
  minutes TEXT,
  action_items TEXT,
  status VARCHAR(30) DEFAULT 'scheduled',
  file_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, meeting_code)
);

CREATE TABLE IF NOT EXISTS ppm_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inspection_code VARCHAR(50) NOT NULL,
  project_code VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  inspection_type VARCHAR(60) DEFAULT 'qa',
  inspection_date DATE DEFAULT CURRENT_DATE,
  result VARCHAR(40) DEFAULT 'pass',
  inspector_name VARCHAR(200),
  findings TEXT,
  status VARCHAR(30) DEFAULT 'completed',
  file_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, inspection_code)
);

CREATE TABLE IF NOT EXISTS ppm_ncr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ncr_code VARCHAR(50) NOT NULL,
  project_code VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'medium',
  capa TEXT,
  status VARCHAR(30) DEFAULT 'open',
  closed_date DATE,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, ncr_code)
);

CREATE TABLE IF NOT EXISTS ppm_asset_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  allocation_code VARCHAR(50) NOT NULL,
  project_code VARCHAR(50),
  asset_name VARCHAR(200) NOT NULL,
  asset_type VARCHAR(60) DEFAULT 'equipment',
  quantity DECIMAL(12,2) DEFAULT 1,
  start_date DATE,
  end_date DATE,
  status VARCHAR(30) DEFAULT 'allocated',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, allocation_code)
);

CREATE TABLE IF NOT EXISTS ppm_inventory_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  allocation_code VARCHAR(50) NOT NULL,
  project_code VARCHAR(50),
  item_name VARCHAR(200) NOT NULL,
  sku VARCHAR(80),
  quantity DECIMAL(14,3) DEFAULT 0,
  uom VARCHAR(30) DEFAULT 'EA',
  status VARCHAR(30) DEFAULT 'reserved',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, allocation_code)
);

-- ============================================================
-- APPROVALS / NOTIFICATIONS / SETTINGS / AUDIT / AI / COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS ppm_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  approval_number VARCHAR(50) NOT NULL,
  entity_table VARCHAR(80) NOT NULL,
  entity_id UUID,
  entity_code VARCHAR(80),
  title VARCHAR(255) NOT NULL,
  workflow_step VARCHAR(80) DEFAULT 'review',
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | rejected
  requested_by UUID REFERENCES user_profiles(id),
  approver_id UUID REFERENCES user_profiles(id),
  decision_notes TEXT,
  decided_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, approval_number)
);

CREATE TABLE IF NOT EXISTS ppm_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  severity VARCHAR(20) DEFAULT 'info',
  category VARCHAR(60) DEFAULT 'general',
  project_code VARCHAR(50),
  is_read BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ppm_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSONB DEFAULT 'null'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, setting_key)
);

CREATE TABLE IF NOT EXISTS ppm_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(60) NOT NULL,
  entity_table VARCHAR(80),
  entity_id UUID,
  entity_code VARCHAR(80),
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ppm_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  score DECIMAL(5,2),
  recommendations JSONB DEFAULT '[]'::jsonb,
  project_code VARCHAR(50),
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ppm_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_table VARCHAR(80) NOT NULL,
  entity_id UUID,
  body TEXT NOT NULL,
  author_name VARCHAR(150),
  created_by UUID REFERENCES user_profiles(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ppm_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES ppm_projects(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  baseline_name VARCHAR(100) NOT NULL,
  baseline_date DATE DEFAULT CURRENT_DATE,
  start_date DATE,
  end_date DATE,
  budget DECIMAL(18,2) DEFAULT 0,
  snapshot_json JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ppm_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  event_type VARCHAR(40) DEFAULT 'milestone',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT true,
  status VARCHAR(30) DEFAULT 'scheduled',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Projects PPM', 'ppm.view', 'ppm', 'View project portfolio management'),
  ('Manage Projects PPM', 'ppm.manage', 'ppm', 'Create and edit projects and tasks'),
  ('PPM Plan', 'ppm.plan', 'ppm', 'Planning WBS Gantt resources'),
  ('PPM Execute', 'ppm.execute', 'ppm', 'Task execution time tracking'),
  ('PPM Finance', 'ppm.finance', 'ppm', 'Budget costing billing'),
  ('PPM Approve', 'ppm.approve', 'ppm', 'Project and change approvals'),
  ('PPM Portal', 'ppm.portal', 'ppm', 'Customer and supplier portals'),
  ('PPM AI Assistant', 'ppm.ai', 'ppm', 'AI project intelligence'),
  ('PPM Admin', 'ppm.admin', 'ppm', 'Full project administration')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug OR p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'ppm.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'ppm.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'finance_manager','auditor'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ppm_portfolios','ppm_programs','ppm_categories','ppm_project_types','ppm_templates',
    'ppm_project_requests','ppm_business_cases','ppm_projects','ppm_wbs','ppm_milestones',
    'ppm_deliverables','ppm_tasks','ppm_checklists','ppm_dependencies','ppm_sprints',
    'ppm_backlog','ppm_roadmap','ppm_resources','ppm_resource_allocations','ppm_timesheets',
    'ppm_time_logs','ppm_budgets','ppm_expenses','ppm_purchase_requests','ppm_invoices',
    'ppm_progress_claims','ppm_retentions','ppm_revenue','ppm_documents','ppm_change_requests',
    'ppm_risks','ppm_issues','ppm_decisions','ppm_lessons','ppm_meetings','ppm_inspections',
    'ppm_ncr','ppm_asset_allocations','ppm_inventory_allocations','ppm_approvals',
    'ppm_notifications','ppm_settings','ppm_audit_log','ppm_ai_insights','ppm_comments',
    'ppm_baselines','ppm_calendar_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL USING (company_id = public.user_company_id() OR company_id IS NULL) WITH CHECK (company_id = public.user_company_id() OR company_id IS NULL)',
        t || '_all', t
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE
  cid UUID := 'a0000000-0000-4000-8000-000000000001';
  pid UUID;
  proj UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = cid) THEN
    SELECT id INTO cid FROM companies LIMIT 1;
  END IF;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO ppm_categories (company_id, code, name, description) VALUES
    (cid, 'STRATEGIC', 'Strategic Initiatives', 'Company-wide strategic programs'),
    (cid, 'OPS', 'Operations', 'Operational improvement projects'),
    (cid, 'CUST', 'Customer Delivery', 'Customer-facing delivery projects'),
    (cid, 'CAPEX', 'Capital Projects', 'CAPEX investments')
  ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO ppm_project_types (company_id, code, name, default_methodology) VALUES
    (cid, 'MFG', 'Manufacturing', 'waterfall'),
    (cid, 'CUST', 'Customer', 'hybrid'),
    (cid, 'ICT', 'ICT', 'agile'),
    (cid, 'CONST', 'Construction', 'waterfall'),
    (cid, 'INT', 'Internal', 'hybrid'),
    (cid, 'RD', 'R&D', 'agile'),
    (cid, 'MAINT', 'Maintenance', 'waterfall'),
    (cid, 'CAPEX', 'Capital (CAPEX)', 'waterfall'),
    (cid, 'GOV', 'Government Contracts', 'waterfall'),
    (cid, 'SECURE', 'Secure Printing', 'hybrid')
  ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO ppm_portfolios (company_id, portfolio_code, name, owner_name, strategic_theme, budget_total, health_score, status)
  VALUES
    (cid, 'PF-2026-CORE', '2026 Core Portfolio', 'PMO Office', 'Growth & Excellence', 5000000000, 82, 'active'),
    (cid, 'PF-SECURE', 'Secure Print Portfolio', 'Operations Director', 'Product Excellence', 2000000000, 88, 'active')
  ON CONFLICT (company_id, portfolio_code) DO NOTHING;

  SELECT id INTO pid FROM ppm_portfolios WHERE company_id = cid ORDER BY created_at LIMIT 1;

  INSERT INTO ppm_programs (company_id, portfolio_id, program_code, name, sponsor_name, manager_name, budget, status)
  VALUES
    (cid, pid, 'PRG-ERP', 'ERP Modernization Program', 'MD Office', 'Program Manager', 800000000, 'active'),
    (cid, pid, 'PRG-SEC', 'Secure Credential Program', 'Ops Director', 'Print Ops Lead', 1200000000, 'active')
  ON CONFLICT (company_id, program_code) DO NOTHING;

  INSERT INTO ppm_templates (company_id, template_code, name, project_type, methodology, default_duration_days, status)
  VALUES
    (cid, 'TPL-WATERFALL', 'Standard Waterfall Project', 'internal', 'waterfall', 120, 'active'),
    (cid, 'TPL-AGILE', 'Agile Delivery Template', 'ict', 'agile', 90, 'active'),
    (cid, 'TPL-SECURE', 'Secure Print Job Template', 'secure_print', 'hybrid', 45, 'active')
  ON CONFLICT (company_id, template_code) DO NOTHING;

  INSERT INTO ppm_settings (company_id, setting_key, setting_value, description) VALUES
    (cid, 'default_currency', '"UGX"', 'Default project currency'),
    (cid, 'default_methodology', '"hybrid"', 'Default project methodology'),
    (cid, 'spi_warn_threshold', '0.9', 'SPI warning below'),
    (cid, 'cpi_warn_threshold', '0.9', 'CPI warning below'),
    (cid, 'require_timesheet_approval', 'true', 'Timesheets need approval'),
    (cid, 'retention_default_pct', '10', 'Default retention %')
  ON CONFLICT (company_id, setting_key) DO NOTHING;

  INSERT INTO ppm_resources (company_id, resource_code, name, resource_type, skills, capacity_hours_week, cost_rate, bill_rate, status)
  VALUES
    (cid, 'RES-PM-01', 'Project Manager Pool', 'employee', 'PMP,Agile', 40, 80000, 150000, 'available'),
    (cid, 'RES-DEV-01', 'Software Engineers', 'employee', 'Full-stack,ERP', 160, 60000, 120000, 'available'),
    (cid, 'RES-PRINT-01', 'Secure Print Operators', 'employee', 'Security print', 200, 40000, 0, 'available')
  ON CONFLICT (company_id, resource_code) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM ppm_projects WHERE company_id = cid LIMIT 1) THEN
    INSERT INTO ppm_projects (
      company_id, project_code, name, description, portfolio_name, program_name,
      category_name, project_type, methodology, lifecycle_stage, priority, status, health,
      manager_name, sponsor_name, start_date, end_date, percent_complete,
      budget_planned, budget_actual, planned_value, earned_value, actual_cost, spi, cpi,
      billing_method, qr_payload
    ) VALUES (
      cid, 'PRJ-2026-ERP', 'Hope SecureTrack ERP Rollout',
      'Enterprise ERP implementation across manufacturing, finance, fleet and identity.',
      '2026 Core Portfolio', 'ERP Modernization Program', 'Strategic Initiatives',
      'ict', 'hybrid', 'execution', 'high', 'active', 'green',
      'PMO Lead', 'Managing Director', CURRENT_DATE - 30, CURRENT_DATE + 150, 35,
      500000000, 175000000, 180000000, 175000000, 175000000, 0.97, 1.00,
      'milestone', 'PPM:PRJ-2026-ERP'
    ) RETURNING id INTO proj;

    INSERT INTO ppm_wbs (company_id, project_id, project_code, wbs_code, name, node_type, sort_order, percent_complete, status)
    VALUES
      (cid, proj, 'PRJ-2026-ERP', '1', 'Initiation', 'phase', 1, 100, 'done'),
      (cid, proj, 'PRJ-2026-ERP', '2', 'Planning', 'phase', 2, 100, 'done'),
      (cid, proj, 'PRJ-2026-ERP', '3', 'Execution', 'phase', 3, 40, 'open'),
      (cid, proj, 'PRJ-2026-ERP', '3.1', 'Core Modules', 'deliverable', 4, 50, 'open'),
      (cid, proj, 'PRJ-2026-ERP', '4', 'Closure', 'closure', 5, 0, 'open');

    INSERT INTO ppm_milestones (company_id, project_id, project_code, milestone_code, name, due_date, status, is_billing, owner_name)
    VALUES
      (cid, proj, 'PRJ-2026-ERP', 'MS-01', 'Kickoff Complete', CURRENT_DATE - 20, 'achieved', false, 'PMO Lead'),
      (cid, proj, 'PRJ-2026-ERP', 'MS-02', 'Core Modules Live', CURRENT_DATE + 30, 'pending', true, 'PMO Lead'),
      (cid, proj, 'PRJ-2026-ERP', 'MS-03', 'Go-Live', CURRENT_DATE + 120, 'pending', true, 'PMO Lead');

    INSERT INTO ppm_tasks (company_id, project_id, project_code, task_code, name, assignee_name, priority, status, estimated_hours, actual_hours, start_date, due_date, percent_complete, board_column)
    VALUES
      (cid, proj, 'PRJ-2026-ERP', 'TSK-001', 'Requirements freeze', 'Business Analyst', 'high', 'done', 40, 38, CURRENT_DATE - 25, CURRENT_DATE - 15, 100, 'done'),
      (cid, proj, 'PRJ-2026-ERP', 'TSK-002', 'Fleet module delivery', 'Engineering', 'high', 'in_progress', 120, 60, CURRENT_DATE - 10, CURRENT_DATE + 20, 50, 'in_progress'),
      (cid, proj, 'PRJ-2026-ERP', 'TSK-003', 'PPM module delivery', 'Engineering', 'high', 'in_progress', 100, 40, CURRENT_DATE - 5, CURRENT_DATE + 25, 40, 'in_progress'),
      (cid, proj, 'PRJ-2026-ERP', 'TSK-004', 'UAT cycle 1', 'QA Lead', 'normal', 'todo', 80, 0, CURRENT_DATE + 20, CURRENT_DATE + 40, 0, 'todo'),
      (cid, proj, 'PRJ-2026-ERP', 'TSK-005', 'Training & handover', 'PMO Lead', 'normal', 'todo', 60, 0, CURRENT_DATE + 50, CURRENT_DATE + 70, 0, 'todo');

    INSERT INTO ppm_budgets (company_id, budget_code, project_id, project_code, category, planned_amount, actual_amount, status)
    VALUES
      (cid, 'BDG-LABOR', proj, 'PRJ-2026-ERP', 'labor', 300000000, 120000000, 'active'),
      (cid, 'BDG-SVC', proj, 'PRJ-2026-ERP', 'services', 150000000, 40000000, 'active'),
      (cid, 'BDG-CONT', proj, 'PRJ-2026-ERP', 'contingency', 50000000, 15000000, 'active');

    INSERT INTO ppm_risks (company_id, risk_code, project_id, project_code, title, probability, impact, risk_score, mitigation, owner_name, status)
    VALUES
      (cid, 'RSK-001', proj, 'PRJ-2026-ERP', 'Scope creep across modules', 'high', 'high', 16, 'Change control board weekly', 'PMO Lead', 'mitigating'),
      (cid, 'RSK-002', proj, 'PRJ-2026-ERP', 'Key resource unavailability', 'medium', 'high', 12, 'Cross-train backup owners', 'HR Partner', 'open');

    INSERT INTO ppm_issues (company_id, issue_code, project_id, project_code, title, severity, status, owner_name)
    VALUES
      (cid, 'ISS-001', proj, 'PRJ-2026-ERP', 'UAT environment capacity constraints', 'medium', 'open', 'Infra Lead');

    INSERT INTO ppm_sprints (company_id, project_id, project_code, sprint_code, name, start_date, end_date, capacity_hours, status)
    VALUES
      (cid, proj, 'PRJ-2026-ERP', 'SPR-12', 'Sprint 12 - Fleet and PPM', CURRENT_DATE - 7, CURRENT_DATE + 7, 320, 'active');

    INSERT INTO ppm_calendar_events (company_id, project_code, title, event_type, start_at, all_day, status)
    VALUES
      (cid, 'PRJ-2026-ERP', 'Core Modules Live', 'milestone', (CURRENT_DATE + 30)::timestamptz, true, 'scheduled'),
      (cid, 'PRJ-2026-ERP', 'Steering Committee', 'meeting', (CURRENT_DATE + 3)::timestamptz, false, 'scheduled');
  END IF;

  INSERT INTO ppm_ai_insights (company_id, insight_type, title, summary, severity, score, recommendations, project_code)
  SELECT cid, v.t, v.title, v.sum, v.sev, v.sc, v.rec::jsonb, 'PRJ-2026-ERP'
  FROM (VALUES
    ('schedule', 'SPI trending below baseline on engineering tasks',
     'Two critical tasks have slip risk of 5-8 days if capacity stays flat.',
     'warning', 76.0,
     '["Reallocate 1 senior engineer","Protect critical path","Freeze non-critical scope"]'),
    ('budget', 'Labor actuals tracking plan - contingency draw at 30%',
     'Services category may overrun if external consultants extend.',
     'info', 68.0,
     '["Review open POs","Negotiate fixed-fee close-out"]'),
    ('risk', 'Scope creep risk elevated',
     'Change requests clustering around secure print integrations.',
     'warning', 81.0,
     '["Weekly CCB","Prioritize must-have only for go-live"]')
  ) AS v(t, title, sum, sev, sc, rec)
  WHERE NOT EXISTS (SELECT 1 FROM ppm_ai_insights WHERE company_id = cid LIMIT 1);

END $$;
