# Production Hardening Runbook

Enable controls **after** privileged users enroll MFA and dual-control processes are trained.

## Environment flags (Vercel production)

```bash
# Required
NODE_ENV=production
PAYMENT_SANDBOX=false          # never true in real production
BILLING_WEBHOOK_SECRET=...     # long random
PLATFORM_PROVISIONING_PUBLIC=false
PLATFORM_PROVISIONING_SECRET=...  # invite-only if needed
QR_ENCRYPTION_KEY=...          # 64 hex chars

# Production defaults (ON when NODE_ENV=production unless set to false)
# Set to false only during controlled pilot / MFA enrollment windows:
# MFA_ENFORCE_PRIVILEGED=false
# DUAL_CONTROL_REQUIRED=false
# Explicit true forces on in any environment:
# MFA_ENFORCE_PRIVILEGED=true
# DUAL_CONTROL_REQUIRED=true

# Never enable unless explicit emergency
ALLOW_PRODUCTION_SANDBOX=false

# Strongly recommended — multi-instance rate limits (public portal / AI)
# /api/health reports productionSafe=false when Redis is missing in production
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Token storage (portal + device push tokens)
# Production defaults to hash-only at rest. Temporary migration flags:
# ALLOW_PLAINTEXT_TOKENS=true          # store plaintext + hash (dev only recommended)
# ALLOW_TOKEN_PLAINTEXT_LOOKUP=true    # allow hash-miss plaintext lookup during cutover
# After all tokens re-hashed, leave both unset in production.

# Optional — SecureTrack AI copilot (OpenAI-compatible)
SECURETRACK_AI_API_KEY=...
SECURETRACK_AI_BASE_URL=https://api.openai.com/v1
SECURETRACK_AI_MODEL=gpt-4o-mini
# SECURETRACK_AI_DISABLED=true   # force rules-only assistant

# Phase 2 — job worker + rate limit posture
JOB_WORKER_SECRET=...          # or CRON_SECRET for /api/jobs/worker
# RATE_LIMIT_FAIL_CLOSED=true
# RATE_LIMIT_REQUIRE_REDIS=true  # deny when Upstash missing (strict multi-instance)
```

## Migrations

Apply through:
- `00068` — workflow instances, import audit, portal/device hash columns  
- `00069` — `job_queue`, `job_dead_letters`, integration `push_token_hash`

## Job worker (cron)

```bash
# every minute
curl -X POST "$APP_URL/api/jobs/worker" \
  -H "x-job-secret: $JOB_WORKER_SECRET"
```

## Server money APIs (prefer over browser)

| Action | Endpoint | UI |
|--------|----------|-----|
| Process payroll run | `POST /api/payroll/process` | Payroll → Runs |
| Bank file | `POST /api/payroll/bank-file` (+ `dual_control_id`) | Payroll → Runs |
| Release / pay | `POST /api/payroll/release` (+ `dual_control_id`) | Payroll → Runs |
| GL auto-post | `POST /api/finance/post` (+ `dual_control_id`) | Finance → Engine |
| Sales order create | `POST /api/sales/orders` | Sales |
| Invoice issue | `POST /api/invoices/issue` | Sales / Billing |
| Three-way match | `POST /api/procurement/match` | Procurement → Matching |

## Entity master data (EntityPages)

Module grids (Finance / Payroll / Fleet / Sales / Attendance / TA / PPM / Labels / MES)
use **SecureEntityPage** → `GET/POST/PUT/DELETE /api/v2/crud/{table}`.

- Tenant/company from session only
- Permissions from entity registry
- Soft delete + audit via CRUD engine
- Do **not** write finance/payroll masters via browser Supabase client

## Notifications

Prefer `notifyUsersAsync()` so delivery goes through `job_queue` → worker.  
Force sync only with `NOTIFICATIONS_SYNC=true` or `{ sync: true }`.

## Phase 3–4 quality commands

```bash
npm test                          # unit + security + a11y checklist
npm run test:e2e                  # Playwright smoke + a11y (+ auth if E2E_*)
npm run test:e2e:auth             # authenticated flows only
npm run test:e2e:a11y             # axe WCAG scans
npm run test:load                 # health load smoke
npm run test:load:certify         # multi-endpoint report → docs/
npm run audit:deps                # dependency evidence JSON
INTEGRATION_TESTS=true npm run test:security   # live RLS (+ RLS_USER_A/B_*)
```

See `docs/CI_SECRETS.md`, `docs/SOC2_ISO_EVIDENCE_PACK.md`, and `docs/PENTEST_READINESS.md`.

## Phase 5–6 ops

```bash
npm run drill:dr              # quarterly DR checklist → docs/DR_DRILL_EVIDENCE.json
npm run openapi:generate      # docs/openapi.json
npm run sbom                  # docs/SBOM.json
npm run test:e2e:payroll      # dual-control money path
# UI: /dashboard/platform/ops — production flag posture
```

Optional CAPTCHA (login guard):

```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
# or HCAPTCHA_SECRET_KEY + NEXT_PUBLIC_HCAPTCHA_SITE_KEY
LOGIN_CAPTCHA_ALWAYS=false
```

Apply migration **00070** for API idempotency keys.  
Sign residual risks in `docs/RISK_REGISTER.md` before pilot.

## Go-live order

1. Deploy security code + migration `00067`.  
2. Privileged users enable MFA (Identity → Self-service).  
3. Set `MFA_ENFORCE_PRIVILEGED=true`.  
4. Train makers/checkers; create dual-control for payroll/identity.  
5. Set `DUAL_CONTROL_REQUIRED=true`.  
6. Validate webhooks with gateway sandbox then production.  
7. Confirm CI green on `master`.  
8. Run DR restore drill within 30 days.

## APIs requiring dual-control when enabled

- `POST /api/identity/provision` (body: `dual_control_id`)  
- `POST /api/identity/reset-password` (body: `dual_control_id`)  

Create/approve via `POST /api/security/dual-control`.
