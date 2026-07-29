# Enterprise Communication & Notification Platform

Central hub for branded multi-channel messaging, PDF document delivery, event-driven automation, and full audit across Hope SecureTrack ERP.

## Migration

`supabase/migrations/20260101000052_enterprise_communication_hub.sql`

## Architecture

```
ERP Module Event
      ↓
comm_event_rules (audience + channels + attach_docs)
      ↓
comm_messages (branded content)
      ├── comm_attachments / comm_document_jobs (PDF + QR)
      ├── notification_deliveries / comm_delivery_events
      ├── notifications (in-app)
      └── email_outbox / Resend (server)
      ↓
comm_audit_log
```

## Library

```
src/lib/communications/
  types.ts
  service.ts   — compose, publishCommEvent, templates, campaigns, AI draft
  index.ts
```

Key APIs:

- `composeMessage` — branded multi-channel queue + auto attachments
- `publishCommEvent` — fire rules by event key
- `retryMessage` — retry failed
- `aiDraftEmail` — professional draft assistant

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/communications` | Hub |
| `…/compose` | Compose |
| `…/email` `…/sms` `…/whatsapp` `…/push` `…/in-app` `…/hopechat` | Channel centers |
| `…/documents` `…/pdf-jobs` | Document delivery |
| `…/rules` | Event rules + test fire |
| `…/templates` | Templates |
| `…/campaigns` `…/broadcasts` `…/announcements` | Broadcast |
| `…/scheduled` `…/reminders` | Automation |
| `…/deliveries` `…/retry` | Ops |
| `…/providers` `…/audit` `…/ai` | Admin / AI |
| `/dashboard/notifications` | User inbox |

## Permissions

`comm.view` · `comm.manage` · `comm.broadcast` · `comm.templates` · `comm.admin` · `comm.ai`

## Integration

Call `publishCommEvent({ company_id, event_key, source_module, vars, entity_code })` from any module after a business event (PO approved, leave submitted, invoice generated, QC failed, etc.).
