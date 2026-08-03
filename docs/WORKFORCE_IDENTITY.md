# Workforce Identity & Credential Management Platform

SecureTrack ERP module for **digital identity, physical ID cards, access control, biometrics (status), print, and security governance**.

## Navigation

**Dashboard → ID Credentials** (`/dashboard/credentials`)

Also linked from **HR** hub.

## Lifecycle

Recruitment → Identity creation → HR verification → Credential generation → Design → Approval → Printing → Activation → Access assignment → Monitoring → Renewal → Suspension → Termination → Archiving

## Modules

| Module | Path | Purpose |
|--------|------|---------|
| Hub | `/dashboard/credentials` | Security KPIs & module grid |
| Identities | `.../identities` | Multi-identity CRUD + issue card |
| ID Cards | `.../cards` | Credential lifecycle, print, activate, suspend |
| Design Studio | `.../designer` | Canvas layers, fields, QR, hologram, versions |
| Templates | `.../templates` | Executive / factory / security / visitor |
| AI Designer | `.../ai` | Prompt → layout + security features |
| Print Queue | `.../print` | Approve, print, retry (Zebra…browser) |
| Inventory | `.../inventory` | Blank PVC/RFID stock |
| Access | `.../access` | Zones, profiles, assignments, events |
| Biometrics | `.../biometrics` | Enrollment **status only** (no raw templates) |
| Verify | `.../verify` | QR digital identity verification |
| Lost/Stolen | `.../lost` | Full replacement workflow |
| Mobile Badge | `.../mobile` | Digital wallet / offline window |
| Security Centre | `.../security` | Failed scans, access, posture |
| Reports | `.../reports` | CSV registers & audit exports |
| Branding | `.../branding` | Colours, watermark, signatures |
| Numbering | `.../numbering` | HDG-EMP-YYYY-###### engine |
| Workflows | `.../workflows` | Onboard / lost / terminate |

## Database

Migration: `supabase/migrations/20260101000024_workforce_identity_credentials.sql`

Key tables: `wid_identities`, `wid_credentials`, `wid_card_templates`, `wid_access_*`, `wid_print_jobs`, `wid_card_inventory`, `wid_biometric_enrollments`, `wid_verification_logs`, `wid_mobile_badges`, `wid_workflows`, …

Permissions: `wid.view`, `wid.manage`, `wid.design`, `wid.print`, `wid.access`, `wid.security`, `wid.verify`, `wid.biometrics`

## Libraries

- `src/lib/workforce-id/` — types, ID engine, QR tokens, card HTML/print, AI designer, service helpers

## Apply migration

```bash
npx supabase db push
# or run SQL in Supabase SQL editor
```

## Print

Uses the same hidden-iframe strategy as business documents (`printCardHtml`) so popup blockers do not block ID card printing after async loads.
