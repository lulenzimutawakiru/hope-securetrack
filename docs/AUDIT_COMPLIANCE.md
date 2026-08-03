# Enterprise Audit Logging & Compliance Platform

SecureTrack ERP — immutable enterprise audit trail, security monitoring, digital forensics, GRC, and AI fraud analytics.

## Why not a simple activity log

This platform provides:

- **Enterprise audit trail** with hash-chained, append-only storage  
- **Before/after field tracking** on every update  
- **Live security dashboard** (sessions, failed logins, high-risk)  
- **AI security analytics** (fraud, exfiltration, privilege, night activity)  
- **Compliance frameworks** (ISO 27001, ISO 9001, SOC 2, GDPR, Uganda DPA, financial audit)  
- **Incident management** bridged to Service Desk  
- **API / print / file / export** specialized audits  
- **Approval chain of custody** with digital signatures  

## Migration

```text
supabase/migrations/20260101000039_enterprise_audit_compliance.sql
```

Extends legacy `audit_logs` with integrity and correlation columns. Adds `eal_*` enterprise tables.

### Core tables

| Table | Purpose |
|-------|---------|
| `eal_events` | Hash-chained enterprise event stream (immutable) |
| `eal_integrity_checkpoints` | Chain verification snapshots |
| `eal_sessions` | Live session security |
| `eal_alerts` | Security alerts |
| `eal_incidents` | IR cases → Service Desk |
| `eal_approvals` | Multi-step approval trails |
| `eal_api_calls` | API audit |
| `eal_exports` | Export monitoring |
| `eal_print_audit` | Print forensics |
| `eal_file_audit` | Document version actions |
| `eal_frameworks` / `eal_controls` / `eal_evidence` | Compliance |
| `eal_audit_packages` | Regulatory packages |
| `eal_retention_policies` | Retention 30d → permanent |
| `eal_ai_insights` | Stored AI findings |
| `eal_config` | Alert channels & thresholds |

Legacy `audit_logs` remains append-only (DB trigger prevents UPDATE/DELETE).

## Permissions

`eal.view` · `eal.manage` · `eal.investigate` · `eal.export` · `eal.ai` · `eal.compliance`  

Also uses existing `audit.view` / `audit.manage` for nav access.

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/audit` | Hub |
| `/dashboard/audit/events` | Advanced search + before/after |
| `/dashboard/audit/live` | Live security (15s refresh) |
| `/dashboard/audit/alerts` | Security alerts |
| `/dashboard/audit/incidents` | Incident response |
| `/dashboard/audit/ai` | AI analytics |
| `/dashboard/audit/integrity` | Hash chain verify |
| `/dashboard/audit/approvals` | Approval trails |
| `/dashboard/audit/compliance` | Frameworks & controls |
| `/dashboard/audit/packages` | Audit packages |
| `/dashboard/audit/api` | API audit |
| `/dashboard/audit/exports` | Export monitor |
| `/dashboard/audit/print` | Print audit |
| `/dashboard/audit/files` | File audit |
| `/dashboard/audit/sessions` | Sessions |
| `/dashboard/audit/retention` | Retention policies |
| `/dashboard/audit/legacy` | Original audit_logs |

## Library

`src/lib/audit/`

- `service.ts` — `logAuditEvent`, alerts, incidents, approvals, exports, API/print/file, packages, chain verify  
- `integrity.ts` — hash chain, field diff  
- `ai.ts` — risk scoring & insights  
- `types.ts` — modules, severities, frameworks  

### Log an event from any module

```ts
import { logAuditEvent } from "@/lib/audit";

await logAuditEvent({
  company_id,
  user_id,
  user_email: "user@example.com",
  module: "finance",
  event_type: "invoice.created",
  action: "Invoice created",
  crud_op: "create",
  entity_type: "invoice",
  entity_reference: "INV-1001",
  before_state: null,
  after_state: { amount: 4500000 },
  severity: "info",
});
```

High-risk events (score ≥ 70) auto-create `eal_alerts`.

## Immutability

1. DB trigger blocks UPDATE/DELETE on `eal_events` and `audit_logs`  
2. Each event stores `prev_hash` + `integrity_hash` + `chain_index`  
3. Integrity page re-verifies and writes checkpoints  

## Compliance seed

- ISO/IEC 27001 (A.12.4.x, A.9.2.1, A.16.1.1)  
- SOC 2 (CC6.1, CC7.2, CC8.1)  
- GDPR (Art.30, Art.32)  
- Uganda Data Protection and Privacy Act  
- ISO 9001 change control  
- Financial audit framework  

## Advanced (migration 00040)

```text
supabase/migrations/20260101000040_enterprise_audit_advanced.sql
```

| Feature | Tables / routes |
|---------|-----------------|
| Logging policies | `eal_logging_policies` · `/audit/config` |
| Config history | `eal_config_history` |
| Secure archive | `eal_archive_batches` · `eal_archived_events` · dual-control retrieval |
| Findings | `eal_findings` |
| SIEM | Splunk / Sentinel / QRadar / Elastic / webhook · `/audit/siem` |
| Report defs | 11 system reports · `/audit/reports` |
| Executive / IT | `/audit/executive` · `/audit/it` |
| Mobile PWA center | `/audit/mobile` |

### Role matrix (§22)

| Role | Capabilities |
|------|----------------|
| Internal Auditor | View all, export, investigate, archive |
| Compliance Officer | Compliance, packages, executive |
| IT Security | Security events, incidents, AI |
| System Administrator | Infra/config only — **cannot** alter events |
| Executive | Summary dashboards |
| Super Admin | Full config — **still cannot** edit/delete events (DB trigger) |

### REST API

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/audit/events` | Query / append events |
| GET/POST | `/api/audit/siem` | Connectors · flush outbox |
| GET | `/api/audit/reports?code=` | Run system report |

### Library additions

- `reports.ts` — security scores, 11 report runners, CSV export  
- `archive.ts` — seal, request, approve, fulfill retrieval  
- `siem.ts` — format adapters + outbox flush  
- `policies.ts` — logging policy CRUD + role matrix  
- `ai.ts` — summarize, correlate, explain, executive brief, evidence hints  

## Operations

1. Apply migrations `00039` and `00040` on Supabase.  
2. Confirm seed events, frameworks, policies, SIEM connectors, report defs.  
3. Open **Audit & Compliance** → Executive / Live / Integrity.  
4. Configure SIEM connectors; enable only after endpoints are set.  
5. Wire ERP modules to `logAuditEvent` / REST `/api/audit/events`.  
6. Seal cold periods via **Secure Archive**; use dual-control retrieval for audits.  
