# Enterprise Packaging & Packing Management

SecureTrack ERP — full packaging lifecycle from finished goods to carton, pallet, warehouse, and shipment preparation with QR hierarchy for SecureTrack Paper.

## SecureTrack Paper standard

```
Ream (unique QR)
  → 5 reams per Carton (master QR)
    → 40 cartons per Pallet (master QR)
```

## Migrations

```text
supabase/migrations/20260101000037_enterprise_packaging.sql
```

Uses existing `reams` / `cartons` / `qr_codes` from initial schema. Extends cartons with weight/seal/line/WO/pallet fields.

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/packaging` | Hub |
| `/dashboard/packaging/materials` | Packaging materials stock |
| `/dashboard/packaging/rules` | Product pack rules |
| `/dashboard/packaging/cartonization` | Carton/pallet planner |
| `/dashboard/packaging/work-orders` | Packing WOs |
| `/dashboard/packaging/lines` | Packing lines |
| `/dashboard/packaging/floor` | Operator scan & pack |
| `/dashboard/packaging/pallets` | Pallet build |
| `/dashboard/packaging/weighing` | Scale capture |
| `/dashboard/packaging/qc` | Packing QC |
| `/dashboard/packaging/packing-lists` | Shipping packing lists |
| `/dashboard/packaging/hierarchy` | QR tree demo |
| `/dashboard/packaging/analytics` | KPIs |
| `/dashboard/packaging/ai` | AI assistant |
| `/dashboard/packaging/mobile` | Mobile floor guide |

Legacy: `/dashboard/packing` (5-ream scan UI)

## Permissions

`pkg.view` · `pkg.manage` · `pkg.operate` · `pkg.approve` · `pkg.ai`  
(+ legacy `packing.create`)

## Library

`src/lib/packaging/`

- `cartonization.ts` — units → cartons → pallets, material estimate  
- `hierarchy.ts` — ream/carton/pallet QR payloads  
- `service.ts` — WO, pack carton, build pallet, QC, weight, packing list  
- `ai.ts` — insights & recommendations  
- `packing-list.ts` — PDF HTML  

## Core flow

1. Configure **materials** & **product rules** (5 reams / carton).  
2. Create **work order** from production qty → auto cartonization.  
3. Assign **packing line**.  
4. **Floor**: scan reams → pack carton → materials issued.  
5. **Weigh** + **QC**.  
6. **Palletize** cartons → master QR.  
7. **Packing list** for dispatch.  

## Operations

1. Apply migration `00037`.  
2. Confirm seed materials, A4 rule, lines, sample WO.  
3. Open **Packaging → Floor** to pack cartons.  
4. Build pallets and packing lists before shipment.  
