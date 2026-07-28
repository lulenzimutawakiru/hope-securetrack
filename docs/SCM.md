# Enterprise Supply Chain Management (SCM) — Hope Design Group Ltd

**Strategic planning, control tower, and resilience layer**  
Distinct from Procurement & Logistics (execution) — SCM optimizes the full network.

## Architecture

```
Customer Demand → Demand Planning → S&OP → Supply Planning
  → Procurement → Inventory → Manufacturing → Distribution → Delivery → Returns
```

## Routes

| Area | Path |
|------|------|
| SCM hub | `/dashboard/scm` |
| Control tower | `/dashboard/scm/tower` |
| Demand planning | `/dashboard/scm/demand` |
| S&OP | `/dashboard/scm/sop` |
| MRP | `/dashboard/scm/mrp` |
| DRP | `/dashboard/scm/drp` |
| Risks | `/dashboard/scm/risks` |
| KPIs | `/dashboard/scm/kpis` |
| Sustainability | `/dashboard/scm/sustainability` |
| Reports | `/dashboard/scm/reports` |

## Core objects

- `demand_forecasts` — multi-horizon demand
- `sop_cycles` / `sop_line_items` — S&OP
- `bom_headers` / `bom_lines` — product structure for MRP
- `mrp_runs` / `mrp_recommendations` — purchase / produce / transfer
- `drp_plans` — inter-warehouse balancing
- `supply_chain_risks` — resilience register
- `scm_kpi_snapshots` — scorecard
- `scm_sustainability` — ESG
- `scm_insights` — AI recommendations

## Permissions

| Slug | Purpose |
|------|---------|
| `scm.view` | Control tower & plans |
| `scm.manage` | Run MRP / edit forecasts |
| `scm.sop` | Approve S&OP |
| `scm.risk` | Risk register |

## Integrations

- Procurement (PO, PR, inbound)
- Inventory (balances, transfers, GRN)
- Sales (orders for demand signals)
- Production (BOM / capacity planning surface)
- Fleet & dispatch (logistics KPIs)

## Seeded demo

- 6-week Premium A4 forecast (~+22% ramp)
- S&OP `SOP-2026-Q3` in review
- BOM `BOM-A4-PREM`
- MRP `MRP-2026-0727` with purchase/produce/transfer
- DRP Main → DC Kampala
- Risks: packaging OTD, pulp capacity, Jinja corridor
- KPI + ESG H1 2026 snapshots
