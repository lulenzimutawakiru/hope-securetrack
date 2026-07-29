# Production · Manufacturing Execution System (MES)

Enterprise MES for Hope SecureTrack — planning, shop floor, quality, OEE, packaging, costing, AI.

## Migration

- Base: `20260101000028_enterprise_manufacturing_mes.sql`
- Complete: `20260101000051_enterprise_mes_complete.sql`

## Library

```
src/lib/mes/
  service.ts   — production orders, work orders, release
  crud.ts      — generic list/create/update/soft-delete/duplicate/bulk/export
  bom.ts mrp.ts oee.ts costing.ts
  menu.ts      — full navigation tree
```

## UI

Hub: `/dashboard/production` — real-time stats + full module directory.

Reusable CRUD: `src/components/mes/mes-entity-page.tsx` powers entity screens with:

Create · Edit · Soft delete · Duplicate · Bulk status · Search · Filter · Export CSV · Audit log

Specialized screens remain for: Orders, Shop Floor, BOM, Routing, Work Centers, Machines, Planning, MRP, OEE, Quality, Batches.

## Menu coverage

Planning, MPS, MRP, Calendar, Orders, Batches, Job Cards, Shop Floor, Work Instructions, BOM, Routing, Lines, Machines, Groups, Capacity, Scheduling, Maintenance, Operators, Shifts, QC, Inspections, Lab, NCR, Rework, Waste, Downtime, OEE, Monitoring, IoT, Energy, Materials, Consumables, Traceability, Packaging, Labels, Serials, Pallets, Costing, Variance, Reports, Analytics, AI, Documents, Approvals, Audit, Settings.

## Permissions

`mes.view` · `mes.manage` · `mes.operate` · `mes.quality` · `mes.plan` · `mes.cost` · `mes.admin` · `mes.ai`  
plus `production.view` / `production.manage`.
