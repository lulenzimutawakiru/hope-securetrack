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
PLATFORM_PROVISIONING_PUBLIC=false
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
