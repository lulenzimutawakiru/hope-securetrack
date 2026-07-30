# Enterprise Talent Acquisition & Recruitment

Hope SecureTrack ERP module for end-to-end hiring: workforce planning → ATS → offer → onboarding.

## Entry points

| Surface | Path |
|---------|------|
| Talent hub | `/dashboard/talent` |
| ATS pipeline | `/dashboard/talent/ats` |
| Public careers | `/careers` |
| Apply | `/careers/apply?vacancy=VAC-…` |
| Public apply API | `POST /api/public/careers/apply` |

## Submodules

Planning, job library, vacancies, candidates, applications, talent pool, referrals, agencies, campus, assessments, interviews, background/reference/medical, offers, onboarding tasks, documents, AI, analytics, settings, audit.

## Lifecycle

Plan → Requisition → Vacancy → Apply → Screen → Assess → Interview → Verify → Offer → Onboard → HR/Payroll/Identity.

## Permissions

`ta.view` · `ta.manage` · `ta.recruit` · `ta.approve` · `ta.ai` · `ta.admin` · `ta.portal`

## Schema (migration 00062)

Tables prefixed `ta_*` including vacancies, candidates, applications, pipeline stages, interviews, offers, onboarding, agencies, referrals, AI insights, audit.

## Lib

`src/lib/ta/` — menu, entities, crud, service (stats + match score), ai

## Integrations

HR, Payroll, Identity, Attendance devices (biometric enrollment task), Communications notifications, Finance budget on requisitions.
