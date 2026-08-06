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
Settings → Environment Variables (Production) **before** deploying. For
self-service signup (`/register`) you must set one of:

- `PLATFORM_PROVISIONING_PUBLIC=true` — open SaaS signup (rate-limited)
- `PLATFORM_PROVISIONING_SECRET=<invite code>` — invite-only registration

Without either, `/register` returns `403 SIGNUPS_DISABLED`, no tenant/admin
account is created, and new-user login reports "invalid credentials".

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
