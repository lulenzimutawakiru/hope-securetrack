# Remediation Implementation Status

**Date:** 2026-08-04  
**Source:** Critical codebase analysis remediation (P0–P4)

## Summary — COMPLETE for browser write ban + domain migration

| Gate | Status |
|------|--------|
| UI browser Supabase **writes** | **0** (strict CI) |
| Lib enforced browser writes | **0** (all domain services listed) |
| Lib debt inventory | **0** |
| `--lib-strict` | **Passes** |
| Vitest security + unit | **223 passed**, 13 skipped (live RLS without secrets) |
| Entity registry | **~585** `defineEntity` entries (includes bulk domain tables) |

**Allowlisted browser client only:**

- `src/lib/offline/sync.ts` — offline queue replay
- `src/lib/storage/upload.ts` — Storage object API (not table registry)
- Limited self-service UI paths (profile, identity sessions, chat notifications)

All other domain libs use either:

1. **Domain helpers** (`mustList` / `mustCreate` / …) → `/api/v2/crud`
2. **`@/lib/supabase/crud-compat`** drop-in `createClient()` that routes table I/O through CRUD

---

## Implemented

### P0 — Isolation & gates
| Item | Status | Notes |
|------|--------|--------|
| Scoped service-role client | Done | `src/lib/supabase/scoped-admin.ts` |
| Invoice pay uses scoped admin + dual-control | Done | `billing.invoice_pay` |
| Browser Supabase write ban | Done | `scripts/check-browser-writes.mjs` |
| Settings/labels/enterprise write migration | Done | CRUD API |
| Service-role audit | Done | `scripts/check-service-role.mjs` |
| RLS inventory | Done | `scripts/rls-inventory.mjs` |
| Portal plaintext tokens blocked in production | Done | Code-enforced |
| CI static security gates | Done | browser-writes + service-role + rls-inventory |

### P1 — Money / lifecycle / storage
| Item | Status | Notes |
|------|--------|--------|
| Dual-control on invoice pay | Done | With payroll/finance/identity |
| Tenant offboarding control plane | Done | Migration + API |
| Storage path isolation helpers | Done | `src/lib/storage/isolation.ts` |
| Domain event consumers + DLQ | Done | `src/lib/jobs/domain-events.ts` |

### Domain modules (all browser-table-write free)

| Module | Path | Mechanism |
|--------|------|-----------|
| Enterprise company | `enterprise-company/` | domain helpers |
| CRM | `crm/service.ts` | domain helpers |
| Finance | `finance/service.ts`, `engine.ts` | domain helpers / server |
| Assets | `assets/service.ts` | domain helpers |
| Attendance | `engine.ts`, `ai.ts` | domain helpers |
| Audit | `service`, `archive`, `policies`, `siem`, `reports` | domain helpers |
| Payroll | `payroll/service.ts` | domain helpers |
| Branding | `branding/service.ts` | crud-compat |
| Communications | `communications/service.ts` | crud-compat |
| Digital identity | `digital-identity/service.ts` | crud-compat |
| Dispatch | `dispatch/service.ts` | crud-compat |
| Fleet | `fleet/service.ts` | crud-compat |
| HopeChat | `hopechat/service.ts`, `enterprise.ts` | crud-compat |
| IDM | `idm/service.ts`, `governance.ts` | crud-compat |
| Labels | `lbl/service.ts` | crud-compat |
| MES | `mes/service.ts` | crud-compat |
| Packaging | `packaging/service.ts` | crud-compat |
| PPM | `ppm/service.ts` | crud-compat |
| Print | `print/service.ts`, `automation.ts` | crud-compat |
| Profile | `profile/service.ts` | crud-compat |
| Sales | `sales/service.ts` | crud-compat |
| Service desk | `service-desk/service.ts` | crud-compat |
| SRM | `srm/service.ts` | crud-compat |
| Talent acquisition | `ta/service.ts`, `activity.ts` | crud-compat |
| Tenant | `tenant/service.ts` | crud-compat |
| Unified identity | `unified-identity/service.ts` | crud-compat |
| Contracts | `contracts/service.ts` | crud-compat |
| Documents brand | `documents-brand.ts` | crud-compat |
| Platform | `platform/service.ts`, `events.ts` | domain helpers |
| System settings | `system-settings.ts` | domain helpers |

AI insight modules (`fleet/ai`, `lbl/ai`, `ppm/ai`, `sales/ai`, `ta/ai`, etc.) use domain helpers.

### Entity registry bulk
- Script: `scripts/bulk-register-entities.mjs`
- Tables list: `scripts/debt-tables.txt`
- Bulk block appends `softDelete: true` for EntityPage compatibility

### CI `LIB_ENFORCED`
All modules above are listed in `scripts/check-browser-writes.mjs` → any reintroduction of `@/lib/supabase/client` **writes** fails CI.

---

## UI read migration (2026-08-04 next)

| Item | Status | Notes |
|------|--------|--------|
| Bulk dashboard → `crud-compat` | Done | **372** pages/components swapped off browser client |
| Top hubs → `crudCount` / `crudList` | Done | billing, HR, service-desk, identity, inventory (+ prior main/assets/attendance) |
| Engine `not_in` / `neq` filters | Done | KPI filters like open tickets / open AR |
| List pageSize cap | 500 | Supports hub aggregations without unbounded responses |
| Extra entity registrations | +48 | BI, billing, HR, pay, SD, SCM tables used by UI |

**Still on browser client (intentional):**

| Path | Reason |
|------|--------|
| `chat/page.tsx` | Realtime channels |
| `chat/notifications/page.tsx` | Allowlist self-service |
| `identity/self-service`, `identity/sessions` | Allowlist |
| `settings/profile` | Allowlist |
| `inventory/grn`, `inventory/reservations` | RPC |
| `packing`, `qr-codes` | Auth helpers |

## Remaining (product / ops)

1. **Live RLS CI** — `rls-live.test.ts` needs integration secrets; enable nightly with two tenants.
2. **SSO / SAML** — enterprise IAM product work.
3. **Reporting read models / multi-region / load certify** — tooling exists (`test:load`); schedule in staging.
4. **Generate real `database.types.ts`** — `npm run db:generate-types` when Supabase is local.
5. **`REQUIRE_TENANT_ON_ROWS=true`** — enable only after full `tenant_id` backfill.
6. **`RATE_LIMIT_REQUIRE_REDIS=true`** — multi-instance production with Upstash.
7. **Tighten bulk entity permissions** — bulk registrations use module-default view/manage; refine per-table where product requires finer RBAC.
8. **Migrate RPC/auth special pages** — GRN/reservations RPC + packing/qr-codes auth off browser client when dedicated APIs exist.

---

## Ops checklist after deploy

```bash
# Apply migration
supabase db push   # includes tenant_offboarding + domain_events status

# Production env
MFA_ENFORCE_PRIVILEGED=true
DUAL_CONTROL_REQUIRED=true
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
RATE_LIMIT_REQUIRE_REDIS=true
JOB_WORKER_SECRET=...
```

## Commands

```bash
npm run check:browser-writes -- --strict
npm run check:browser-writes -- --strict --lib-strict
npm run check:service-role -- --strict
npm run check:rls-inventory
npm run test:security
npm test
```
