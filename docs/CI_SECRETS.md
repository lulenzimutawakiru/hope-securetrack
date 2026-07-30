# CI & Integration Secrets

Configure these in GitHub Actions (Settings → Secrets and variables → Actions) to enable Phase 4 gates.

## Core app (build / unit)

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key for client + RLS tests |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for live RLS probes |

## Live RLS proof

| Secret / env | Purpose |
|--------------|---------|
| `INTEGRATION_TESTS` | Set to `true` to enable live tests |
| `RLS_USER_A_EMAIL` | Test user in company A |
| `RLS_USER_A_PASSWORD` | Password |
| `RLS_USER_B_EMAIL` | Test user in company B |
| `RLS_USER_B_PASSWORD` | Password |
| `RLS_COMPANY_A_ID` | Optional UUID of company A |
| `RLS_COMPANY_B_ID` | Optional UUID of company B |

```bash
INTEGRATION_TESTS=true \
NEXT_PUBLIC_SUPABASE_URL=... \
NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
RLS_USER_A_EMAIL=a@example.com RLS_USER_A_PASSWORD=... \
RLS_USER_B_EMAIL=b@example.com RLS_USER_B_PASSWORD=... \
npm run test:security
```

## Authenticated Playwright

| Secret | Purpose |
|--------|---------|
| `E2E_EMAIL` | Dashboard user email (maker) |
| `E2E_PASSWORD` | Password |
| `E2E_CHECKER_EMAIL` | Optional second user (dual-control checker) |
| `E2E_CHECKER_PASSWORD` | Checker password |
| `E2E_PAYROLL_RUN_ID` | Optional UUID for bank-file release path |
| `BASE_URL` | Optional override (default local webServer) |

```bash
E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
E2E_EMAIL=... E2E_PASSWORD=... E2E_CHECKER_EMAIL=... E2E_CHECKER_PASSWORD=... \
  npm run test:e2e:payroll
```

## Job worker / production

See `PRODUCTION_HARDENING_RUNBOOK.md` for `JOB_WORKER_SECRET`, MFA, dual-control, Upstash, AI keys.

## Recommended CI jobs

1. **quality** — always: typecheck, unit tests, readiness audit  
2. **integration-rls** — when `INTEGRATION_TESTS` secret is `true`  
3. **e2e** — public smoke always (best-effort build); full auth when E2E secrets set  
4. **dependency-audit** — write report; optional `AUDIT_FAIL=true` after remediation  
