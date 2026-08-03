# Enterprise Project Portfolio Management (PPM)

SecureTrack ERP module covering full project lifecycle:

**Request → Business Case → Plan → Execute → Monitor → Bill → Close**

## Supported project types

Manufacturing · Customer · ICT · Construction · Internal · R&D · Maintenance · CAPEX · Government · Secure Printing

## Capabilities

- Portfolio / Program / Project hierarchy
- Templates, requests, business cases, approvals
- WBS, milestones, deliverables, tasks, dependencies
- Gantt schedule view and Kanban board
- Agile sprints, backlog, roadmap
- Resources, allocations, timesheets, time logs
- Budgets, expenses, purchase requests, inventory/asset allocation
- Documents, change control, risks, issues, decisions, lessons, meetings
- QA inspections & NCR/CAPA
- Billing: invoices, progress claims, retention, revenue recognition
- Customer / supplier portal views
- AI Project Assistant, reports CSV, analytics, audit log

## Routes

Base: `/dashboard/projects`

Full menu: `src/lib/ppm/menu.ts`

## Permissions

| Slug | Description |
|------|-------------|
| `ppm.view` | View PPM |
| `ppm.manage` | Create/edit projects |
| `ppm.plan` | WBS Gantt resources |
| `ppm.execute` | Tasks and time |
| `ppm.finance` | Budget and billing |
| `ppm.approve` | Approvals |
| `ppm.portal` | Customer/supplier portals |
| `ppm.ai` | AI assistant |
| `ppm.admin` | Full admin |

## Database

Migration: `supabase/migrations/20260101000055_enterprise_project_management.sql`

Tables use `ppm_*` prefix (separate from billing `bill_projects` and profile projects).

## Lib

- `src/lib/ppm/crud.ts` — generic CRUD + audit + CSV
- `src/lib/ppm/entities.ts` — field configs for all entities
- `src/lib/ppm/service.ts` — dashboard, Gantt, Kanban
- `src/lib/ppm/ai.ts` — SPI/CPI/risk/budget insights
- `src/components/ppm/ppm-entity-page.tsx` — full CRUD UI

## ERP integration

- Finance: budgets, invoices, revenue, retention
- Procurement: project purchase requests
- HR/Workforce: resources and timesheets
- CRM/Sales: opportunity / contract / SO refs on projects
- Inventory & Assets: allocation tables
- Communications: notifications for milestones and overruns
- Audit: `ppm_audit_log`
