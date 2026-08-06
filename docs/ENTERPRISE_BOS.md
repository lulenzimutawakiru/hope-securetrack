# SecureTrack Enterprise BOS — Blueprint & Gap Analysis

**Status:** Foundation (P0) — this document is the living blueprint for turning
SecureTrack ERP into a metadata-driven, AI-powered, event-driven Enterprise
Business Operating System (BOS).

SecureTrack is **not a greenfield** — it already ships an unusually deep ERP
core (155 migrations, 635 registered Business Objects, ~60 module libraries,
RLS across every table, audit, workflows, AI gateway, reporting, offline sync).
The BOS transformation is therefore about *systematizing* and *generalizing*
what exists into a configurable enterprise platform, then closing the gaps that
prevent admin-driven configuration without code.

---

## 1. Existing Foundation (verified)

| Capability | Where it lives |
| --- | --- |
| Metadata entity registry (635 Business Objects) | `src/lib/metadata/entity-registry.ts` |
| Generic tenant-safe CRUD engine | `src/lib/crud/crud-engine.ts` + `/api/v2/crud/[entity]` |
| Domain event table + consume/claim/dead-letter | `domain_events` table, `src/lib/jobs/domain-events.ts` |
| Typed event publishing (P0, new) | `src/lib/events/bus.ts` |
| Workflow state machine + instances | `src/lib/workflows/engine.ts`, `workflow_instances` |
| AI gateway (LLM + rule fallback) + governance | `src/lib/ai/gateway.ts`, `src/lib/ai/governance.ts` |
| Industry packs (manufacturing, healthcare, …) | `src/lib/industry/engine.ts` |
| Reporting/BI (analyst, export, KPIs, schedules) | `src/lib/reporting/` |
| Offline capture + sync | `src/lib/offline/db.ts`, `src/lib/offline/sync.ts` |
| SSO / SCIM / unified identity | `src/lib/sso`, `src/lib/unified-identity`, `src/lib/idm` |
| Tenant/company session isolation | `src/lib/tenant/context.ts` (never trusts URL/body) |
| Audit + SIEM + dual control | `src/lib/audit/`, `src/lib/security/` |
| Multi-currency | `currencies`/`exchange_rates` in finance migrations |
| i18n | `next-intl` (`i18n.ts`) |

---

## 2. Gap Analysis by Platform Principle

Legend: ✅ exists · 🔶 partial · ⛔ missing

### 2.1 Metadata-Driven Platform 🔶
- ✅ TS entity registry drives generic CRUD; every entity has permissions,
  lifecycle flags, searchable/sortable columns.
- ✅ `entity_metadata` table exists (migration `0002`).
- ✅ P0: `EntityCapabilities` (universal BO capability surface) added to the
  registry; catalog API `GET /api/v2/metadata/entities`; sync
  `POST /api/v2/metadata/entities` (platform staff) persists the catalog to
  `entity_metadata` (migration `20260810000001_enterprise_bos_platform.sql`).
- ⛔ **Admin-created entities/modules without code** — no UI/API yet to create
  tables, fields, forms, menus from metadata. *P1:* metadata CRUD for entities,
  fields, forms, nav; the CRUD engine then serves any metadata-defined entity
  (table must exist; generate via migration/DDL service).

### 2.2 Universal Business Object Architecture ✅/🔶
- ✅ Every registry entity already carries UUID, tenant/company scoping, soft
  delete, archive, audit columns, search, workflows, API endpoint, permissions.
- ✅ P0: full capability surface (attachments, photos, comments, notes,
  activities, tasks, related records, timeline, QR, barcode, RFID, digital
  signature, tags, custom fields, AI insights, risk score, notifications,
  audit trail, version history, search index, approvals, encryption, data
  retention) declared once in `entity-registry.ts` — no module re-implements.
- 🔶 Generic services (attachments, comments, tags, tasks) are built per-module
  in some places. *P1:* one generic `bo_*` service layer keyed by `entity`.

### 2.3 Complete Tenant Isolation ✅ (extend)
- ✅ RLS enabled on every business table; session-derived tenant/company;
  engine asserts tenant + company on every row; audit stripped of client IDs.
- ✅ Domain events carry `tenant_id`/`company_id`/`actor_id` and RLS restricts
  reads/writes (P0 bus stamps from session scope only).
- 🔶 Search is per-entity; no global search index yet (see 2.8).
- 🔶 Notifications/websockets/offline sync exist but should be audited for
  explicit tenant predicates. *P1:* isolation audit across storage, jobs,
  websockets, exports.

### 2.4 Enterprise AI Platform 🔶
- ✅ `ai/gateway.ts` (LLM + deterministic fallback), `ai/governance.ts`
  (AI_RESTRICTED_ACTIONS, human approval, dual control), tenant-safe by design.
- 🔶 One copilot-style surface; no specialized agents (Finance AI, HR AI, …).
  *P1:* agent registry — each agent = prompt + tools + permissions + event
  subscription, all metadata. *P2:* agent training/eval per tenant.

### 2.5 Event-Driven Enterprise Platform 🔶 → ✅ (P0 core)
- ✅ `domain_events` table + `emit_domain_event()` SQL helper + consume/claim/
  dead-letter workers (`src/lib/jobs/domain-events.ts`), correlation IDs,
  `domain_event.consume` queue handler.
- ✅ **P0 (new):** `publishDomainEvent` / `publishEntityEvent` in
  `src/lib/events/bus.ts`; the CRUD engine now emits
  `{entity}.created|updated|deleted|restored|archived|imported` for **every**
  Business Object with session-scoped tenant/company/actor.
- ⛔ Webhooks are not yet wired to the domain event stream
  (`intg_webhook_subscriptions` exists). *P1:* `{entity}.*` wildcard handlers →
  webhook delivery; Kafka/NATS adapters; event replay API.

### 2.6 Workflow Platform 🔶
- ✅ State-machine engine + `workflow_instances`; CRUD lifecycle enqueues
  workflow jobs (`onCreate`/`onUpdate`/`onDelete`).
- 🔶 Approvals/dual control exist for money/identity paths; no no-code designer
  or dynamic approvers/SLA timers UI. *P1:* visual designer writing
  `workflow_instances` config; escalations, SLAs, delegation metadata.

### 2.7 Universal Search ⛔
- 🔶 Per-entity `?search=` (ilike over `searchable` columns).
- ⛔ No cross-module search, OCR, semantic search, saved searches.
  *P1:* universal search index (entity + title + body + tags + tenant_id +
  company_id), respecting the same permission map as CRUD.

### 2.8 Enterprise Reporting ✅ (extend)
- ✅ `src/lib/reporting/` — definitions, engine, export (PDF/Excel/CSV/JSON),
  KPIs, dashboards, schedules, drill-downs.
- 🔶 No drag-and-drop designer or AI narrative reports yet. *P1:* report
  designer metadata; *P2:* AI narrative via `ai/gateway.ts`.

### 2.9 Digital Twin ⛔
- 🔶 Asset/fleet/PPM modules carry lifecycle data (procurement, maintenance,
  warranty, IoT sensors in fleet).
- ⛔ No unified Digital Twin object. *P1:* `digital_twins` table keyed by
  `entity` + `entity_id` with a generic timeline/health-score/scorecard.

### 2.10 Offline-First 🔶
- ✅ `src/lib/offline/db.ts` (local encrypted) + `sync.ts` (delta sync).
- 🔶 Only some modules surface offline capture. *P1:* per-entity offline policy
  in the metadata registry + conflict resolution on sync.

### 2.11 Enterprise Security ✅ (extend)
- ✅ RLS, RBAC, MFA, dual control, audit, SIEM, rate limiting, SSO/SCIM, API
  key management, immutable audit design.
- 🔶 ABAC, passkeys, SAML provider coverage, DLP, session monitoring
  dashboards. *P1:* ABAC policy metadata; *P2:* passkeys + SAML.

### 2.12 Performance & Scalability 🔶
- ✅ SSR, code splitting, virtualized grids, optimistic UI, realtime, jobs.
- 🔶 No Redis caching layer, read replicas, or CDN edge config in-app.
  *P1:* cache metadata (per-entity TTL), queue horizontal scaling, read
  replicas at the Supabase project level.

### 2.13 Industry Packs ✅ (extend)
- ✅ `src/lib/industry/engine.ts` — modules/workflows/custom fields per industry.
- 🔶 No per-industry KPIs, dashboards, AI models, compliance/doc templates
  seeders. *P1:* industry pack = metadata bundle (entities + workflows +
  reports + KPIs + AI agents + templates) applied at tenant provisioning.

### 2.14 Multi-Company / Multi-Branch / Multi-Language / Multi-Currency ✅
- ✅ `companies` + `branches` + `tenant_scoped` engine; currencies; `next-intl`.
- 🔶 Currency conversion is module-local; *P1:* central FX + revaluation events.

---

## 3. Reference Architecture (target)

```text
   UI (Next.js, per-tenant)                Admin Studio (no-code)
        │                                        │
        ▼                                        ▼
   /api/v2/crud/[entity] ──► CRUD Engine ──► Entity Registry (metadata)
        │                        │  audit         │ capabilities
        ▼                        ▼                ▼
   Event Bus (publishDomainEvent)          entity_metadata (DB catalog)
        │
        ▼
   domain_events ──► Workers (claim/consume/dead-letter)
        │                 ├── notifications     ├── webhooks
        │                 ├── SIEM              ├── AI agents
        │                 ├── workflows         └── search index
        ▼
   Realtime / Offline sync / Reporting / Digital Twin
```

---

## 4. Roadmap

### P0 — Foundation (this change, done)
- [x] Typed event bus (`src/lib/events/bus.ts`), wired into every CRUD
  mutation → `{entity}.{action}` events.
- [x] Universal BO capabilities on the registry + `entity_metadata` catalog
  columns + sync API + read API.
- [x] Tests: event publishing, capability surface, CRUD event emission.

### P1 — Configurable Platform
- [ ] Metadata-defined entities: create table + fields + forms + menus via
  admin UI; CRUD engine serves them without code.
- [ ] Webhook subscriptions bound to `{entity}.*` domain events.
- [ ] Universal search index + permission-aware results.
- [ ] AI agent registry (specialized agents per domain, all tenant-scoped).
- [ ] Workflow designer (no-code) storing config as metadata.
- [ ] Digital Twin object for assets/vehicles/equipment.
- [ ] Per-entity offline policy + conflict resolution.

### P2 — Enterprise Scale
- [ ] Kafka/NATS adapter + event replay + event sourcing.
- [ ] ABAC policies, passkeys, SAML provider, DLP, session monitoring.
- [ ] Redis caching + read replicas + CDN edge config.
- [ ] Industry pack bundles (KPIs, dashboards, AI, compliance templates).

---

## 5. This Change (P0) — files

- `src/lib/events/bus.ts` — typed `publishDomainEvent` / `publishEntityEvent`.
- `src/lib/crud/crud-engine.ts` — emits events on create/update/delete/
  restore/archive/import.
- `src/lib/metadata/entity-registry.ts` — `EntityCapabilities` + `getEntityCatalog`.
- `src/app/api/v2/metadata/entities/route.ts` — catalog GET + platform sync POST.
- `supabase/migrations/20260810000001_enterprise_bos_platform.sql` — catalog
  columns + RLS + event tracing indexes.
- `tests/events/event-bus.test.ts`, `tests/metadata/entity-capabilities.test.ts`,
  `src/lib/crud/__tests__/crud-engine.test.ts` (event emission).
