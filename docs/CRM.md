# Hope SecureTrack — Enterprise CRM Platform

World-class Customer Relationship Management fully integrated into Hope SecureTrack ERP.

## Overview

Complete customer lifecycle:

**Lead → Qualification → Opportunity → Quotation → Approval → Sales Order → Production → Packaging → Dispatch → Invoice → Payment → Support → Loyalty → Renewal**

Designed to exceed Salesforce, Dynamics 365, HubSpot, Zoho, Oracle CX, and SAP CX for Hope Design Group’s manufacturing, security printing, and channel operations.

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/crm` | Enterprise CRM hub & lifecycle |
| `/dashboard/crm/accounts` | Customer 360° accounts |
| `/dashboard/crm/contacts` | Unlimited contacts & roles |
| `/dashboard/crm/leads` | Lead capture & AI scoring |
| `/dashboard/crm/opportunities` | Opportunity management |
| `/dashboard/crm/pipeline` | Kanban pipeline & forecast |
| `/dashboard/crm/activities` | Calls, visits, follow-ups |
| `/dashboard/crm/timeline` | Chronological activity history |
| `/dashboard/crm/credit` | Credit limits, holds, risk |
| `/dashboard/crm/contracts` | Agreements & renewals |
| `/dashboard/crm/campaigns` | Marketing automation |
| `/dashboard/crm/segments` | Dynamic audiences |
| `/dashboard/crm/loyalty` | Points & tiers |
| `/dashboard/crm/feedback` | CSAT / NPS / sentiment |
| `/dashboard/crm/communications` | Email · SMS · WhatsApp hub |
| `/dashboard/crm/documents` | Customer document vault |
| `/dashboard/crm/dealers` | Distributor & dealer mgmt |
| `/dashboard/crm/tenders` | Government & institutional |
| `/dashboard/crm/portal` | Self-service portal admin |
| `/dashboard/crm/ai` | AI customer intelligence |
| `/dashboard/crm/analytics` | CLV · funnel · targets |
| `/dashboard/crm/mobile` | Field sales mobile CRM |
| `/dashboard/sales/*` | Quotes, orders, pipeline (legacy) |
| `/dashboard/service-desk` | Support tickets (ITSM) |

## Database

- **Base:** `customers`, `sales_leads`, `sales_opportunities`, `quotations`, `crm_*` (migration `00007`)
- **Advanced:** migration `20260101000044_enterprise_crm_advanced.sql`

Key tables:

- `crm_timeline`, `crm_consents`, `crm_segments`, `crm_segment_members`
- `crm_campaign_members`, `crm_loyalty_programs`, `crm_loyalty_tiers`, `crm_loyalty_rewards`
- `crm_documents`, `crm_communications`, `crm_dealers`, `crm_dealer_targets`
- `crm_tenders`, `crm_health_scores`, `crm_portal_requests`
- `crm_merge_log`, `crm_audit_log`, `crm_sales_targets`

Customer 360 extensions: hierarchy (`parent_customer_id`), class/status, GPS, health, churn, CLV, credit hold, portal token, soft-delete, merge.

## Library

```
src/lib/crm/
  types.ts    — domain types, lifecycle constants
  ai.ts       — lead score, health, churn, forecast, NBA, sentiment
  service.ts  — full CRUD+ service layer
  index.ts
```

## Permissions

| Slug | Description |
|------|-------------|
| `crm.view` | View CRM |
| `crm.manage` | Manage accounts/activities |
| `crm.marketing` | Campaigns |
| `crm.service` | Service feedback |
| `crm.leads` | Lead management |
| `crm.opportunities` | Opportunities |
| `crm.ai` | AI intelligence |
| `crm.portal` | Portal admin |
| `crm.credit` | Credit controls |
| `crm.admin` | Merge & admin |
| `crm.export` | Export |

## AI capabilities

- Lead scoring on create/status change
- Customer health score + churn risk
- Pipeline weighted forecast
- Next best action recommendations
- Product recommendations by industry
- Campaign targeting hints
- Timeline AI summaries
- Feedback sentiment (positive / neutral / negative)

## ERP integrations

Sales · Quotations · Orders · Production · Packaging · Dispatch · Inventory · Finance · Invoicing · Payments · Commissions · Service Desk · HopeChat · QR authentication · Documents · BI · Notifications · Portal

## Hope Design Group specifics

1. **QR product authentication** — customers verify authenticity and open tickets
2. **Dealer / distributor management** — territory, targets, commissions
3. **Government & institutional tenders** — framework agreements, bid pipeline
4. **Manufacturing visibility** — order → production → packaging → dispatch tracking via ERP modules linked to the customer account

## Security

- Multi-company RLS (`user_company_id()`)
- Soft-delete & restore
- Consent management (Uganda DPA / GDPR principles)
- Credit holds & audit log
- Portal tokens for self-service
- RBAC via `crm.*` permissions

## Apply migration

```bash
supabase db push
# or run SQL: supabase/migrations/20260101000044_enterprise_crm_advanced.sql
```

## CRUD+

Create · Read · Update · Soft-delete · Restore · Archive · Merge duplicates · Convert lead → customer · Convert opportunity → order (via Sales) · Import/export ready · Bulk credit · Full audit history
