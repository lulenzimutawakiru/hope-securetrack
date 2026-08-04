# Enterprise Ticketing, Case Management & ITSM

SecureTrack ERP — enterprise service desk / case management platform targeting ServiceNow, Jira SM, Zendesk, Freshservice, BMC Helix class capabilities.

## Migrations

```text
supabase/migrations/20260101000030_enterprise_service_desk_itsm.sql
supabase/migrations/20260101000042_enterprise_ticketing_advanced.sql
supabase/migrations/20260805000006_service_desk_enterprise.sql
supabase/migrations/20260805000007_service_desk_ai_cx.sql
supabase/migrations/20260806000001_servicedesk_rls_numbering_sla.sql
supabase/migrations/20260806000002_servicedesk_rls_numbering_sla_fix.sql
supabase/migrations/20260806000003_servicedesk_sla_recalc_tenant_seed.sql
```

### 20260806000001 (ESM security + SLA engine)

- **RLS #1** — `support_tickets` insert allows `sd.portal` (self-service create); update restricted to agents (sd.manage / sd.agent / sd.admin); requesters create via portal and comment through sd_ticket_events
- **RLS #2** — `sd_ticket_events` insert allows portal + ticket creator/assignee (comments/timeline no longer blocked)
- **Ticket numbering** — atomic `next_support_ticket_number(company_id)` via `document_sequences` (`support_ticket`) with row lock
- **SLA columns** — escalation_level, breach flags, notification throttle timestamps
- **Realtime** — `support_tickets`, `sd_ticket_events`, `sd_messages`, `sd_inbound_items` on `supabase_realtime`

### 20260806000002 (tenant hardening follow-up)

- **Revoke over-grant** - removes historical `sd.agent` grant from non-service roles (exec, manager, HR, finance, ops, sales, procurement, auditor); auditor reduced to view/portal
- **Tenant columns** - adds `tenant_id` + FK + NOT NULL + backfill + `tenant_isolation_restrict` policy + auto-set trigger to `sd_messages` and `sd_inbound_items`
- **Auto-set triggers** - `sd_ticket_events`, `sd_ai_sessions` derive tenant_id from company
- **Re-asserts** - `support_tickets` tenant column/FK/trigger/policy and agents-only UPDATE policy (idempotent)

### 20260806000003 (SLA recalc, tenant pass, seeding, webhook ingestion)

- **SLA recalc trigger** - `trg_sla_recalc` on `support_tickets` re-anchors `sla_response_due` / `sla_resolve_due` on status or priority changes (reopen, escalation, re-prioritization); clock stops on closed / resolved / archived / deleted. Insert preserves server-computed due dates.
- **RLS parity** - `sd_escalation_events` re-asserted to match `sd_ticket_events` (permissive company `_all` + RESTRICTIVE tenant policy).
- **Tenant pass** - `tenant_id` column + backfill + FK + trigger + RESTRICTIVE policy on `sd_teams`, `sd_agents`, `sd_sla_policies`, `sd_categories`.
- **Seeding** - default SLA policies (SLA-P1..P4) and escalation rules (`P1 SLA Breach` level 2, `Major Incident` level 3) for every company, with notify roles resolved from actual role slugs.
- **Numbering preview** - `preview_support_ticket_number(company_id)` non-consuming RPC for the POST-only numbering API.

## API-first surface

| Method | Path | Purpose |
|--------|------|---------|
| POST/GET | `/api/v2/servicedesk/tickets` | Create / list tickets (session tenant) |
| POST/GET | `/api/v2/servicedesk/inbound` | Omni-channel ingestion + inbox |
| POST | `/api/v2/servicedesk/ai/triage` | AI triage (+ optional ticket create + LLM enrich) |
| GET/POST | `/api/v2/servicedesk/sla/cron` | SLA warning/breach + escalation engine (CRON_SECRET) |
| POST | `/api/v2/servicedesk/webhooks/email` | Shared-secret email-to-ticket ingestion (no session) |
| POST | `/api/v2/servicedesk/webhooks/whatsapp` | Shared-secret WhatsApp ingestion (no session) |
| POST | `/api/v2/servicedesk/tickets/number` | Preview next ticket number (non-consuming) |

Cron (Vercel): every 5 min SLA scan; every 2 min job worker.

### 00030 (core ITSM)

Extends `support_tickets`; teams, agents, events, SLA, catalog, knowledge, CMDB, problems, changes, field jobs, automation, channels, CSAT.

### 00042 (advanced ticketing)

| Feature | Tables |
|---------|--------|
| Category taxonomy | `sd_categories` |
| Templates | `sd_ticket_templates` |
| Work logs / time | `sd_work_logs` |
| Live messages | `sd_messages` |
| Approvals | `sd_approvals` |
| Major incident war room | `sd_major_incidents` |
| Business calendars | `sd_calendars` · `sd_holidays` |
| Multi-channel inbox | `sd_inbound_items` |
| NPS | `sd_nps_responses` |

Ticket fields: related invoice/product/QR/dispatch, GPS, reopen count, merge, approval status, fraud flag.

## Routes

| Path | Module |
|------|--------|
| `/dashboard/service-desk` | Hub |
| `/dashboard/service-desk/create` | Smart create (AI · templates · QR) |
| `/dashboard/service-desk/tickets` | Ticket lifecycle |
| `/dashboard/service-desk/agent` | Technician workspace |
| `/dashboard/service-desk/major` | Major incident war room |
| `/dashboard/service-desk/approvals` | Multi-level approvals |
| `/dashboard/service-desk/categories` | Unlimited taxonomy |
| `/dashboard/service-desk/inbound` | Email/IoT/WhatsApp inbox |
| `/dashboard/service-desk/catalog` | Service catalog |
| `/dashboard/service-desk/portal` | Self-service portal |
| `/dashboard/service-desk/knowledge` | Knowledge base |
| `/dashboard/service-desk/sla` | SLA & escalation |
| `/dashboard/service-desk/cmdb` | CMDB |
| `/dashboard/service-desk/problems` | Problem management |
| `/dashboard/service-desk/changes` | Change management |
| `/dashboard/service-desk/field` | Field service |
| `/dashboard/service-desk/teams` | Teams & agents |
| `/dashboard/service-desk/automation` | Workflow rules |
| `/dashboard/service-desk/channels` | Omni-channel |
| `/dashboard/service-desk/ai` | AI assistant |
| `/dashboard/service-desk/reports` | Analytics |
| `/dashboard/service-desk/csat` | Satisfaction |
| `/dashboard/service-desk/mobile` | Mobile / PWA guide |

## Permissions

`sd.view` · `sd.manage` · `sd.agent` · `sd.admin` · `sd.knowledge` · `sd.change` · `sd.ai` · `sd.portal` · `sd.approve` · `sd.major` · `sd.field`

## Library

`src/lib/service-desk/`

- `sla.ts` — priority matrix, due dates, breach status  
- `routing.ts` — smart assign by category/skills/load  
- `ai.ts` — triage, KB search, duplicate detect, multi-domain keywords  
- `service.ts` — create, assign, escalate, work logs, messages, merge, reopen, major incident, inbound convert, asset-QR tickets
- `service.ts` — CRUD, catalog, change, field, CSAT  

## Permissions

`sd.view` · `sd.manage` · `sd.agent` · `sd.admin` · `sd.knowledge` · `sd.change` · `sd.ai` · `sd.portal`

## Ticket lifecycle

New → Assigned → Acknowledged → Investigating → Waiting Customer → In Progress → Resolved → Customer Confirmation → Closed → Archived

## Integrations

- CRM customers & legacy tickets  
- Employees / profiles  
- Assets via CMDB / asset tags  
- Resend email channel config  
- Integrations Hub for WhatsApp / Teams / Slack  
- Notifications for SLA warnings  

## Seed data

IT / HR / Finance teams, P1–P4 SLA, catalog items (laptop, password reset…), 4 KB articles, CMDB CIs, sample tickets.
