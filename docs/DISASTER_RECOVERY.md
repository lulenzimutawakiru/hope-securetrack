# SecureTrack ERP — Disaster Recovery & Business Continuity

| Field | Target |
|-------|--------|
| **RPO** (Recovery Point Objective) | ≤ 24 hours (Supabase PITR plan: minutes–hours) |
| **RTO** (Recovery Time Objective) | ≤ 4 hours for core ERP (auth + finance + payroll read) |
| **Primary region** | Vercel `iad1` + Supabase project region |
| **Owner** | Platform / IT operations |

## Components

| Component | Provider | Backup | Restore |
|-----------|----------|--------|---------|
| PostgreSQL | Supabase | Daily backups + PITR (plan-dependent) | Supabase dashboard / support |
| Auth users | Supabase Auth | Included with project backup | Restore project / export |
| Object storage | Supabase Storage | Bucket versioning if enabled | Re-upload / bucket restore |
| Frontend | Vercel | Immutable deployments | Redeploy previous deployment |
| Secrets | Vercel + Supabase env | Documented inventory | Re-inject from vault |

## Immediate incident steps

1. **Declare** severity (P1 = outage / data loss risk).  
2. **Freeze** deploys and schema changes.  
3. **Assess** blast radius (tenant, company, module).  
4. **Communicate** status page / stakeholders.  
5. **Restore** from last known good backup if corruption.  
6. **Verify** RLS, auth login, payroll/finance reads.  
7. **Post-incident** report within 5 business days.

## Restore drill (quarterly)

1. Provision staging Supabase branch or clone.  
2. Restore backup snapshot.  
3. Point staging env to restored DB.  
4. Run: login, company switch, invoice list, payroll hub, portal token load.  
5. Record actual RTO/RPO achieved.  
6. File drill evidence for ISO/SOC.

## Secrets rotation (annual or on breach)

- `SUPABASE_SERVICE_ROLE_KEY`  
- `PLATFORM_PROVISIONING_SECRET`  
- `BILLING_WEBHOOK_SECRET`  
- `QR_ENCRYPTION_KEY`  
- `RESEND_API_KEY`  
- Device push tokens (attendance)

## Multi-tenant isolation after restore

- Confirm no cross-company leakage with two test users.  
- Re-run security regression tests (`npm test`).  
- Verify public provision remains gated.

## Contacts

| Role | Responsibility |
|------|----------------|
| Platform admin | Vercel/Supabase access |
| Security | MFA, dual-control, incident lead |
| Finance | Payment webhook / AR integrity |

*Update this document after each drill.*
