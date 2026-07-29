# Hope SecureTrack — Enterprise Supplier Relationship Management (SRM)

World-class vendor lifecycle, procurement collaboration, performance, and AI intelligence integrated into Hope SecureTrack ERP.

## Overview

**Registration → Qualification → Due Diligence → Approval → Contract → RFQ → PO → Delivery → QC → Invoice Match → Payment → Performance → Renew/Offboard**

Built to exceed SAP Ariba, Oracle Procurement Cloud, Coupa, Ivalua, Jaggaer, Dynamics 365 Procurement, and Odoo Purchase for Hope Design Group manufacturing and secure-print operations.

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/procurement` | Enterprise SRM hub |
| `/dashboard/procurement/suppliers` | Supplier 360° master |
| `/dashboard/procurement/contacts` | Multi-contact management |
| `/dashboard/procurement/categories` | Unlimited categories |
| `/dashboard/procurement/onboarding` | Digital onboarding workflow |
| `/dashboard/procurement/documents` | Certificates & expiry |
| `/dashboard/procurement/timeline` | Supplier activity history |
| `/dashboard/procurement/requisitions` | Demand / CAPEX |
| `/dashboard/procurement/rfq` | RFQ / RFP / RFI |
| `/dashboard/procurement/orders` | Purchase orders |
| `/dashboard/procurement/contracts` | Framework & SLAs |
| `/dashboard/procurement/inbound` | Shipments & logistics |
| `/dashboard/procurement/quality` | Inspections · NCR · CAPA |
| `/dashboard/procurement/matching` | Three-way match |
| `/dashboard/procurement/performance` | Scorecards |
| `/dashboard/procurement/risk` | Risk register |
| `/dashboard/procurement/portal` | Supplier portal admin |
| `/dashboard/procurement/ai` | AI procurement assistant |
| `/dashboard/procurement/analytics` | Executive analytics & risk heatmap |
| `/dashboard/procurement/compliance` | Compliance dashboard |
| `/dashboard/procurement/registry` | Approved supplier registry |
| `/dashboard/procurement/traceability` | Material lot → product chain |
| `/dashboard/procurement/collaboration` | Strategic CPFR collaboration |
| `/dashboard/procurement/mobile` | Field / mobile SRM |
| `/dashboard/procurement/fleet` | Fleet vehicles |
| `/dashboard/inventory/grn` | Goods receipt |

## Database

- **Base:** `suppliers`, `purchase_orders`, `rfqs`, `procurement_contracts`, `inbound_shipments` (migrations `00010`, `00013`)
- **Advanced SRM:** `20260101000045_enterprise_srm.sql`
- **SRM Advanced+:** `20260101000046_enterprise_srm_advanced.sql`

Key tables: `srm_categories`, `srm_contacts`, `srm_onboarding`, `srm_documents`, `srm_timeline`, `srm_quality_inspections`, `srm_ncrs`, `srm_scorecards`, `srm_risks`, `srm_insights`, `srm_communications`, `srm_portal_requests`, `srm_rfq_evaluations`, `srm_match_logs`, `srm_audit_log`, `srm_merge_log`, `srm_registry_items`, `srm_registry_approvals`, `srm_material_lots`, `srm_trace_links`, `srm_compliance_items`, `srm_demand_forecasts`, `srm_capacity_confirmations`, `srm_delivery_slots`, `srm_collab_documents`, `srm_procurement_savings`

## Library

```
src/lib/srm/
  types.ts    — lifecycle, classes, categories
  ai.ts       — scorecards, disruption, recommend, price anomaly, forecast
  service.ts  — full CRUD+ service layer
  index.ts
```

## Permissions

| Slug | Description |
|------|-------------|
| `srm.view` | View SRM |
| `srm.manage` | Manage suppliers/onboarding |
| `srm.approve` | Approve suppliers |
| `srm.contracts` | Contracts |
| `srm.quality` | NCR / QC |
| `srm.ai` | AI intelligence |
| `srm.portal` | Portal admin |
| `srm.admin` | Administration |
| `procurement.*` | Existing procurement rights |

## AI capabilities

- Supplier recommendation ranking
- Disruption risk prediction
- Price anomaly detection
- Negotiation opportunity hints
- Recurring quality issue detection
- Spend forecasting
- Overall scorecard grading (A–F)

## ERP integrations

Procurement · Inventory/GRN · Finance AP · Contracts · Logistics · Fleet · HopeChat · Service Desk · Documents · BI · Notifications · QR/barcode receiving

## CRUD+

Create · Read · Update · Soft-delete · Restore · Archive · Approve · Reject · Suspend · Reactivate · Merge duplicates · Import/export ready · Bulk communication hooks · Full audit history

## Analytics drill-downs

Spend by supplier · Spend by category · Top suppliers · Performance rankings · Contract expiry calendar · Delivery performance · Procurement savings · Supplier risk heatmap

## Apply migrations

```bash
supabase db push
# or run:
# supabase/migrations/20260101000045_enterprise_srm.sql
# supabase/migrations/20260101000046_enterprise_srm_advanced.sql
```

## Hope Design Group specifics

- **Approved registry** for pulp, packaging, security inks, plates, chemicals, machinery, ICT, office
- **Material traceability** from supplier lot → production batch → finished product → QC → complaints/recalls
- **Compliance dashboard** for expiring certs, CAPA, contracts, ESG
- **Strategic collaboration** — demand forecast, capacity confirmations, delivery slots, engineering document exchange
- ISO / tax clearance expiry tracking
- Quality CAPA for inbound packaging damage
- FX risk on international ink vendors
