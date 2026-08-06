# SecureTrack ERP — Deployment Guide

## Environments

| Env | Frontend | Database | Notes |
|-----|----------|----------|-------|
| Development | `npm run dev` | Supabase local or remote | `.env.local` |
| Staging | Vercel preview | Supabase branch/project | Soft production |
| Production | Vercel prod / Docker / K8s | Supabase prod | Hardening flags on |

## Required secrets

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
QR_ENCRYPTION_KEY                 # 64-char hex
BILLING_WEBHOOK_SECRET            # production payments
PLATFORM_PROVISIONING_SECRET      # invite-only signup (optional)
RESEND_API_KEY                    # email
```

## Production flags

```
NODE_ENV=production
PAYMENT_SANDBOX=false
PLATFORM_PROVISIONING_PUBLIC=true       # open SaaS signup on /register; false + secret = invite-only
MFA_ENFORCE_PRIVILEGED=true       # after MFA enrollment
DUAL_CONTROL_REQUIRED=true        # after process training
ALLOW_PRODUCTION_SANDBOX=false
```

## Deploy paths

### A) Vercel (recommended SaaS)

```bash
npm run ci
npx vercel --prod --yes
```

Ensure build heap: package.json uses `--max-old-space-size=6144`.  
Dashboard routes use `force-dynamic` to avoid OOM on static generation.

Environment variables are baked at build time — set them in Vercel Project
Settings → Environment Variables (Production) **before** deploying.

Self-service signup on `/register` is **enabled by default** and rate-limited.
To close open registration, set `PLATFORM_PROVISIONING_PUBLIC=false` and (for
invite-only access) `PLATFORM_PROVISIONING_SECRET=<invite code>`. With signups
closed and no invite secret, `/register` returns `403 SIGNUPS_DISABLED`.

### B) Docker

```bash
docker compose build
docker compose up -d
curl -s http://localhost:3000/api/health
```

### C) Kubernetes

```bash
kubectl create secret generic securetrack-erp-secrets --from-env-file=.env.production
kubectl apply -f k8s/deployment.yaml
```

## Database

```bash
npx supabase db push
```

Apply all migrations through `20260101000067_security_controls_complete.sql`.

## First users

Seed the first tenant administrator before onboarding end users:

```bash
node scripts/bootstrap-users.mjs admin@example.com First Last \
  --password '<temp-password>' \
  --tenant hope-design --company HDG --branch HQ
```

The script:
- Creates the Supabase Auth user via the service-role admin API (email confirmed,
  operator-supplied temporary password — never auto-generated).
- Upserts `user_profiles` scoped to `tenant_id` / `company_id` / `branch_id` /
  `role_id` (default role `super_administrator`), records the primary role in
  `idm_user_roles`, and writes an `idm_audit` entry.
- Forces a password change on first login and enforces MFA for admins (HDG
  `security_policies`: `force_reset_on_first_login=true`,
  `password_expiry_days=90`, `min_password_length=10`).
- `--dry-run` resolves the tenant/company/branch/role and reports what would be
  written without touching the database.
- SecureTrack staff platform admins use `--staff --platform-role
  <owner|cto|security|devops|compliance>` (Control Plane at `/platform`).

Tenant administrators then create further users directly in the app:
- **Identity → Create Account** (`/dashboard/identity/create`) with **Create &
  activate** — the request is created `admin_approved` and provisioned
  immediately (dual-control is bypassed for admins acting inside their own
  tenant; RBAC, MFA enforcement, and tenant isolation still apply).
- **Identity → User directory** (`/dashboard/identity/users`) → **Create
  account** uses the same direct flow.
- Non-administrator user types default to the standard approval flow.

The database already contains seeded demo accounts (JORLEN TECHNOLOGIES, HOPE
DESIGN staff, and legacy HDG profiles); `admin@hopedesign.co.ke` is the
canonical first tenant admin referenced by deployment scripts.

## Post-deploy checklist

1. `/api/health` returns healthy  
2. Login works  
3. Company switcher lists companies  
4. Dual-control page loads for admins  
5. Portal token URL works without staff login  
6. Public provision returns 403 without invite  
7. Payment sandbox disabled  

## Rollback

- **Vercel:** Promote previous deployment  
- **Docker/K8s:** Redeploy previous image tag  
- **DB:** Prefer forward-fix migrations; use PITR only for corruption  

See also: `DISASTER_RECOVERY.md`, `PRODUCTION_HARDENING_RUNBOOK.md`.
