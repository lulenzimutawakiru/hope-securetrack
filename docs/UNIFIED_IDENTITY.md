# Unified Identity & Workforce Ecosystem

**One human being → one Universal Person ID (UPID) → consistent identity across every Hope SecureTrack ERP module.**

## Vision

Stop treating login accounts, employee records, badges, CRM contacts, and portal users as separate people.

| Layer | Store | Purpose |
|-------|--------|---------|
| **Universal Person** | `uw_persons` | Single digital human (UPID) |
| **Auth / IDM** | `user_profiles` | Login, roles, MFA, sessions |
| **Human Capital** | `employees` + profile tables | HR master, leave, skills |
| **Credentials** | `wid_identities` | Badges, QR, physical access |
| **External parties** | CRM/SRM contacts, portals | Customers, suppliers (optional links) |
| **Module entitlements** | `uw_module_entitlements` | Where the person may operate |

## Architecture

```
                 ┌──────────────────────────────┐
                 │  Universal Person (UPID)     │
                 │  HDG-PID-2026-000001         │
                 └──────────────┬───────────────┘
        ┌───────────┬───────────┼───────────┬───────────┐
        ▼           ▼           ▼           ▼           ▼
   Auth/IDM     Employee     ID Badge    CRM/SRM     HopeChat
   (login)      (HR 360°)    (access)    (parties)   (presence)
        │           │           │           │           │
        └───────────┴───────────┴───────────┴───────────┘
                    Module entitlements
     Finance · Production · Dispatch · Assets · Payroll · ITSM
```

## Design principles

1. **One person, one UPID** — immutable across hire, transfer, rebadge, rehire (new link, same person where policy allows).
2. **Linked, not duplicated** — module records reference the person via `uw_person_links` and optional `person_id` FKs.
3. **Lifecycle once** — activate / suspend / terminate / archive on the person; modules consume that status.
4. **Entitlements** — module visibility is explicit (role-derived + manual grants).
5. **Merge-ready** — duplicate persons can be merged with full audit.

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/identity/ecosystem` | Architecture hub, stats, sync |
| `/dashboard/identity/persons` | UPID directory |
| `/dashboard/identity/persons/[id]` | Person 360° graph |
| `/dashboard/identity/*` | IDM (auth, roles, MFA) |
| `/dashboard/profiles` | Digital employee profile |
| `/dashboard/credentials` | Workforce badges & access |

## Database

Migration: `supabase/migrations/20260101000048_unified_workforce_identity.sql`

| Table | Role |
|-------|------|
| `uw_persons` | Master digital person + UPID |
| `uw_person_links` | Person ↔ module entity links |
| `uw_module_entitlements` | Granted ERP surfaces |
| `uw_identity_events` | Lifecycle audit |
| `uw_upid_sequences` | Numbering engine |
| `uw_merge_log` | Merge history |
| `uw_person_360` | Resolution view |

Backfill: employees → persons; orphan `user_profiles` → persons; `wid_identities` linked when employee matches.

## Library

```
src/lib/unified-identity/
  types.ts     — kinds, statuses, module map
  service.ts   — resolve, create, link, merge, 360 graph, sync
  index.ts
```

Key APIs:

- `createPerson` / `listPersons` / `getPersonGraph`
- `resolveByUserProfile` / `resolveByEmployee`
- `linkPerson` / `activatePerson` / `suspendPerson` / `mergePersons`
- `syncFromEmployees` — catch-up unlinked HR records

## Permissions

| Slug | Description |
|------|-------------|
| `uw.view` | View unified directory |
| `uw.manage` | Create & link persons |
| `uw.merge` | Merge duplicates |
| `uw.admin` | Ecosystem admin |

## Cross-module contract

Any module that “owns” a person should:

1. Prefer resolving via `person_id` / UPID.
2. Create a `uw_person_links` row when creating employee, badge, portal user, or contact.
3. Not invent a second “identity number” for the human (badges and employee numbers remain **credentials/roles**, not competing person IDs).

## Apply migration

```bash
supabase db push
# or: 20260101000048_unified_workforce_identity.sql
```

## Hope Design Group usage

- Factory operators, security officers, drivers, office staff → one UPID each.
- Same person clocks in (HR), wears badge (WID), posts in HopeChat, approves finance, runs shop-floor, receives payroll.
- Contractors and visitors are person kinds with limited entitlements and expiring links.
- Customers/suppliers portal users can optionally link to the same person model for B2B collaboration without polluting the workforce directory (via `person_kinds` + link types).
