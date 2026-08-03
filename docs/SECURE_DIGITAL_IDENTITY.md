# SecureTrack Digital Identity — Enterprise Single Source of Truth

**One master identity (UPID) for employees, users, contractors, interns, consultants, portal customers/suppliers, and administrators.**

Designed to rival Microsoft Entra ID, Workday HCM, SAP SuccessFactors, Oracle HCM, BambooHR Enterprise, UKG Pro, Rippling, and Okta Workforce Identity — for manufacturing, secure printing, and multi-branch enterprise operations.

## Architecture

```
                    Master Identity (uw_persons / UPID)
                                   │
     ┌──────────┬──────────┬───────┼───────┬──────────┬──────────┐
     ▼          ▼          ▼       ▼       ▼          ▼          ▼
  HR Emp    ERP User   Payroll  Workforce Attendance Leave   ID Card
  SecureChat  Service    Assets   Projects  Biometrics Docs    Audit
            Desk
```

**Principles**

1. **Exactly one master identity** per human — no duplicate employee records.
2. **HR is authoritative** for workforce data; modules consume and link.
3. **Change once, propagate** via sync rules and lifecycle events.
4. **Provision everything on hire** — ERP, credentials, email profile, SecureChat, SD, portal, payroll, attendance, leave, performance, assets, company ID, QR, MFA flag.
5. **Revoke everything on exit** — auth, cards, biometrics, open assets.

## Database

| Migration | Purpose |
|-----------|---------|
| `00048_unified_workforce_identity.sql` | UPID master, links, entitlements, events, merge |
| `00049_enterprise_digital_identity_lifecycle.sql` | Lifecycle, provision engine, org, clearance, cards, biometrics, vault, AI, approvals |

### Core tables (00049)

| Table | Role |
|-------|------|
| `uw_persons` *(extended)* | Full master profile + lifecycle_stage + clearance |
| `di_org_units` | Unlimited org hierarchy |
| `di_lifecycle_events` | Stage transition history |
| `di_provision_templates` | Hire checklist templates |
| `di_provision_jobs` | Provision / deprovision jobs |
| `di_provision_checklist` | Per-step status |
| `di_sync_rules` / `di_sync_log` | HR field → module targets |
| `di_clearance_assignments` / `di_clearance_matrix` | Security clearance |
| `di_id_card_templates` / `di_id_cards` | Company ID cards |
| `di_biometric_profiles` / `di_biometric_devices` | Biometrics |
| `di_document_vault` | Employment documents |
| `di_asset_assignments` | Person-centric assets |
| `di_ai_insights` | Workforce AI |
| `di_approval_routes` | Unified approval routing |

## Library

```
src/lib/digital-identity/
  types.ts    — stages, clearance, card templates, hire input
  service.ts  — orchestrateHire, lifecycle, sync, cards, biometrics, exit
  index.ts
```

Key APIs:

| Function | Purpose |
|----------|---------|
| `orchestrateHire` | Full hire → UPID + employee + IDM request + modules + card |
| `runProvisionJob` | Re-run checklist engine |
| `advanceLifecycle` | Stage transition + auth/card side effects |
| `orchestrateExit` | Offboard: disable auth, revoke cards/bio, return assets, archive |
| `updateMasterProfile` | Patch person + sync employees + user_profiles + di_sync_log |
| `issueIdCard` / `printIdCard` | Company ID lifecycle |
| `enrollBiometric` | Modality enrollment (hash only, no raw templates) |
| `generateWorkforceInsights` | Rule-based AI from live data |

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/identity` | IDM + digital identity hub |
| `/dashboard/identity/ecosystem` | Unified UPID architecture |
| `/dashboard/identity/persons` | Master person directory |
| `/dashboard/identity/lifecycle` | Full employee lifecycle pipeline |
| `/dashboard/identity/hire` | Hire & auto-provision form |
| `/dashboard/identity/engine` | Provision job checklist engine |
| `/dashboard/identity/org` | Org chart / structure |
| `/dashboard/identity/clearance` | Clearance levels + matrix |
| `/dashboard/identity/id-cards` | Company ID issue / print / reissue |
| `/dashboard/identity/biometrics` | Devices + enrollments |
| `/dashboard/identity/sync` | HR field sync rules + log |
| `/dashboard/identity/workforce-ai` | AI workforce assistant |
| `/dashboard/hr/*` | Human capital (authoritative workforce ops) |
| `/dashboard/payroll/*` | Payroll (linked by person/employee) |
| `/dashboard/profiles` | Digital profile 360° |
| `/dashboard/credentials` | Workforce physical credentials |

## Hire automation checklist

When HR creates an employee via **Hire & Provision**:

1. Master Identity (UPID)
2. HR Employee Record
3. ERP User (IDM provision request)
4. Login credentials (username)
5. Company email profile
6. SecureChat entitlement
7. Service Desk entitlement
8. Employee portal
9. Payroll profile link
10. Attendance / leave / performance ready flags
11. Asset assignment profile
12. Company ID card + QR identity
13. Digital signature placeholder
14. MFA enrollment flag

## Lifecycle stages

`recruitment → interview → offer → hiring → onboarding → probation → confirmation → active → promotion | transfer | training | performance | discipline | leave | suspension → exit → offboarding → archived`

## Security clearance

`visitor | employee | supervisor | manager | finance | hr | executive | administrator | system_owner`

Module matrix controls view / create / approve / admin (e.g. Finance can view payroll but not modify salaries).

## Permissions

`di.view` · `di.manage` · `di.provision` · `di.org` · `di.clearance` · `di.cards` · `di.biometrics` · `di.admin` · `di.ai`

Plus existing `uw.*`, `iam.*`, `hr.*`, `profile.*`.

## Technical capabilities

- SSO / OAuth / OIDC / SAML (IDM SSO module)
- MFA + passkeys path (IDM security)
- RBAC + ABAC
- Row-level security (`user_company_id()`)
- Multi-company / multi-branch
- Event-driven lifecycle + immutable identity events
- Offline-first PWA platform shell
- REST via Next.js App Router APIs + Supabase

## Apply migrations

```bash
# Apply 00048 then 00049 on your Supabase project
supabase db push
# or run SQL files in order in the SQL editor
```

## Related docs

- `docs/UNIFIED_IDENTITY.md` — UPID foundation
- `docs/IDENTITY_IDM.md` — Auth provisioning & governance
- `docs/HRM.md` / `docs/WORKFORCE_IDENTITY.md` / `docs/PAYROLL.md`
