# Enterprise Ticketing, Case Management & ITSM

Hope SecureTrack — enterprise service desk / case management platform targeting ServiceNow, Jira SM, Zendesk, Freshservice, BMC Helix class capabilities.

## Migrations

```text
supabase/migrations/20260101000030_enterprise_service_desk_itsm.sql
supabase/migrations/20260101000042_enterprise_ticketing_advanced.sql
```

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
