# Enterprise Inventory & Stock Management — SecureTrack ERP

**Real-time multi-warehouse inventory**  
**Deployment:** Cloud · On-Premise · Hybrid · Offline-capable (agent/outbox paths)

## Architecture

```
Procurement → Goods Receipt → QC → Warehouse Storage
  → Inventory Control → Production / Sales → Dispatch → Finance
```

## Routes

| Area | Path |
|------|------|
| Inventory hub | `/dashboard/inventory` |
| Stock control (buckets, ABC/XYZ, EOQ) | `/dashboard/inventory/control` |
| Stock balances | `/dashboard/inventory/balances` |
| Serialized stock (reams/cartons) | `/dashboard/inventory/stock` |
| Goods received notes | `/dashboard/inventory/grn` |
| Reservations | `/dashboard/inventory/reservations` |
| Replenishment / PRs | `/dashboard/inventory/replenishment` |
| Transfers | `/dashboard/inventory/transfers` |
| Cycle counts | `/dashboard/inventory/cycle-counts` |
| Adjustments | `/dashboard/inventory/adjustments` |
| Batch / serial traceability | `/dashboard/inventory/traceability` |
| Valuation | `/dashboard/inventory/valuation` |
| Locations (WH / zones / bins) | `/dashboard/inventory/locations` |
| Reports (CSV export) | `/dashboard/inventory/reports` |

## Data model

- Extended `products` master (category, UOM, cost, reorder, batch/serial flags)
- `warehouse_zones`, `warehouse_bins` under warehouses/racks
- `stock_balances` — qty on hand / reserved / quarantine by location & batch
- `goods_receipts` + lines + `accept_grn_line` RPC
- `inventory_inspections` (QC)
- `stock_transfers` / `stock_adjustments` / `cycle_counts`
- Extended `inventory_movements` for product-level valuation
- `inventory_insights` for reorder / overstock signals

## Permissions

| Slug | Purpose |
|------|---------|
| `inventory.view` | View stock & dashboards |
| `inventory.move` | Move serialized reams/cartons |
| `inventory.manage` | Master data & config |
| `inventory.grn` | Goods receipts |
| `inventory.qc` | Quality inspection |
| `inventory.transfer` | Inter-warehouse transfers |
| `inventory.adjust` | Adjustments & cycle counts |
| `inventory.valuation` | Costing views |

## Valuation methods

Configured per product / warehouse: FIFO · Weighted Average · Specific Identification · Standard cost.

## Integration points

- **Production:** reams/cartons + QR serials (`/dashboard/inventory/stock`)
- **Sales / Dispatch:** issue & transit movements
- **Finance:** stock value feeds inventory accounting (module 10)
- **Procurement:** GRN against PO references

## Uganda / manufacturing notes

Seed categories cover raw materials (pulp, ink), packaging, finished goods (A4, exercise books), spares, and consumables typical of security printing and paper manufacturing.
