# Remediation Implementation Status

**Date:** 2026-08-04  
**Source:** Critical codebase analysis remediation (P0–P2)

## Implemented

### P0 — Isolation & gates
| Item | Status | Notes |
|------|--------|--------|
| Scoped service-role client | Done | `src/lib/supabase/scoped-admin.ts` — company/tenant stamps + asserts |
| Invoice pay uses scoped admin + dual-control | Done | `billing.invoice_pay` + event fan-out |
| Browser Supabase write ban | Done | `scripts/check-browser-writes.mjs` (strict in CI) — 0 violations |
| Settings/labels/enterprise write migration | Done | CRUD API; config_change_log dual-writes removed |
| Service-role audit | Done | `scripts/check-service-role.mjs` — 0 high-risk unscoped routes |
| RLS inventory | Done | `scripts/rls-inventory.mjs` — ~100% business tables with RLS signal |
| `database.types.ts` stub + generate script | Done | Regenerate via `npm run db:generate-types` against local Supabase |
| Portal plaintext tokens blocked in production | Done | Code-enforced; no production plaintext lookup |
| CI static security gates | Done | browser-writes + service-role + rls-inventory in `ci.yml` |

### P1 — Money / lifecycle / storage
| Item | Status | Notes |
|------|--------|--------|
| Dual-control on invoice pay | Done | Alongside existing payroll/finance/identity |
| Tenant offboarding control plane | Done | Migration + `src/lib/tenant/offboarding.ts` + `/api/platform/offboarding` |
| Storage path isolation helpers | Done | `src/lib/storage/isolation.ts` + tests |
| Domain event consumers + DLQ path | Done | `src/lib/jobs/domain-events.ts` wired into `domain_event.consume` worker |
| Production hardening runbook update | Done | Redis, dual-control matrix, static gates |

### Tests
- New: `scoped-admin-isolation`, `portal-token-hardening`, `domain-events`
- Full suite: **222 passed**, 13 skipped (live RLS when secrets absent)
- Typecheck: clean

## Remaining (not fully “done” by nature of scale)

These need multi-sprint product work, not a single patch:

1. **Full browser read migration** — hubs still use Supabase client for **reads** (KPI counts); writes are gated. Continue `useEntityList` / `useEntityAll` adoption.
2. **Live RLS CI** — `rls-live.test.ts` still needs integration secrets; enable nightly with two tenants.
3. **SSO / SAML** — not implemented (enterprise IAM product work).
4. **Reporting read models / multi-region / load certify in CI** — tooling exists (`test:load`); schedule in staging.
5. **Generate real `database.types.ts` from live schema** — run `npm run db:generate-types` when Supabase is local.
6. **REQUIRE_TENANT_ON_ROWS=true** — enable only after full `tenant_id` backfill.
7. **RATE_LIMIT_REQUIRE_REDIS=true** — enable on multi-instance production with Upstash configured.
8. **Enterprise-company lib** — create/update use CRUD; remaining inserts in `service.ts` (org structure) still use browser client for non-dashboard lib paths (outside write-ban scan). Migrate remaining `ec_*` writes to CRUD as entities are registered.

## Ops checklist after deploy

```bash
# Apply migration
supabase db push   # includes tenant_offboarding + domain_events status

# Production env
MFA_ENFORCE_PRIVILEGED=true   # default when NODE_ENV=production
DUAL_CONTROL_REQUIRED=true
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
RATE_LIMIT_REQUIRE_REDIS=true
JOB_WORKER_SECRET=...
```

## Commands

```bash
npm run check:browser-writes -- --strict
npm run check:service-role -- --strict
npm run check:rls-inventory
npm run test:security
npm test
```
