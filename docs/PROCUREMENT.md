# Enterprise Procurement & Logistics — SecureTrack ERP

**Source-to-pay · inbound logistics · fleet · supplier performance**  
**Deployment:** Cloud · On-Premise · Hybrid  

## Architecture

```
Demand → Requisition → Budget → Approval → RFQ → PO
  → Inbound → GRN → Inventory → Production/Sales → Dispatch → Delivery
```

## Routes

| Area | Path |
|------|------|
| Hub | `/dashboard/procurement` |
| Suppliers | `/dashboard/procurement/suppliers` |
| Requisitions | `/dashboard/procurement/requisitions` |
| RFQ / Tenders | `/dashboard/procurement/rfq` |
| Purchase Orders | `/dashboard/procurement/orders` |
| Contracts | `/dashboard/procurement/contracts` |
| Inbound logistics | `/dashboard/procurement/inbound` |
| Fleet | `/dashboard/procurement/fleet` |
| Supplier performance | `/dashboard/procurement/performance` |
| Reports | `/dashboard/procurement/reports` |
| GRN (inventory) | `/dashboard/inventory/grn` |
| Dispatch (outbound) | `/dashboard/dispatch` |

## Core tables

- Extended `suppliers` (risk, OTD, scores, approved vendor)
- Extended `purchase_requisitions` (dept, CAPEX/OPEX, budget flags)
- `procurement_contracts`, `rfqs`, `supplier_quotations`
- `purchase_orders` + lines (UUID, version, acknowledgement)
- `inbound_shipments` (freight, tracking, ETA)
- `fleet_vehicles`, `fleet_fuel_logs`, `fleet_maintenance`
- `supplier_scorecards`, `procurement_insights`

## Permissions

| Slug | Purpose |
|------|---------|
| `procurement.view` | View hub & documents |
| `procurement.manage` | Create PO/RFQ/contracts |
| `procurement.approve` | Approve PRs & POs |
| `procurement.suppliers` | Vendor master & scorecards |
| `logistics.view` | Fleet & inbound |
| `logistics.manage` | Manage fleet & shipments |

## Integrations

- **Inventory:** GRN acceptance, stock balances  
- **Finance:** AP invoices / suppliers  
- **Sales Dispatch:** outbound delivery  
- **Replenishment:** inventory PR generation  

## Seeded demo

- Suppliers: pulp, inks, packaging, 3PL  
- Framework contract `CTR-2026-PULP`  
- RFQ `RFQ-2026-0001` with competing quotes  
- PO `PO-2026-0042` linked to GRN  
- Inbound `INB-2026-0011` in transit  
- Fleet UBA/UBB/UBC + fuel log  
- AI insight: packaging OTD 82% reallocation recommendation  
