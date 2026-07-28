# Enterprise CRM — Hope Design Group Ltd

**Industry:** Security Printing · Paper · Engineering  
**Deployment:** Cloud · On-Premise · Hybrid · Offline-capable foundation  

## Lifecycle

```
Lead Generation → Qualification → Opportunity → Quotation → Sales Order
  → Production & Delivery → Invoice & Payment → Customer Support → Loyalty
```

## Application routes

| Area | Path |
|------|------|
| CRM command center | `/dashboard/crm` |
| Accounts 360° list | `/dashboard/crm/accounts` |
| Account 360 detail | `/dashboard/crm/accounts/[id]` |
| Activities | `/dashboard/crm/activities` |
| Contracts | `/dashboard/crm/contracts` |
| Service desk | `/dashboard/crm/service` |
| Loyalty | `/dashboard/crm/loyalty` |
| Campaigns | `/dashboard/crm/campaigns` |
| Pipeline (Sales) | `/dashboard/sales/pipeline` |
| Quotations | `/dashboard/sales/quotations` |

## Data model

- Extended `customers` (loyalty, NPS fields, tags, communication prefs)
- `crm_contacts`
- `crm_activities`
- `crm_notes`
- `crm_contracts`
- `crm_loyalty_ledger`
- `crm_feedback`
- `crm_campaigns`
- `crm_insights`
- Shared: `sales_leads`, `sales_opportunities`, `support_tickets`, orders, invoices

## Integrations

Sales · Finance · Inventory · Manufacturing · SecureTrack verification · WFM (reps)
