# Enterprise Dispatch & Delivery Management

SecureTrack ERP — outbound logistics from order/production through loading, GPS, POD, returns, and customer tracking.

## Lifecycle

```text
Sales/Production → QC → Pack → Dispatch Request → Plan → Assign
  → Load (QR seal) → Approve → GPS Track → Deliver → POD → Invoice
```

## Migrations

```text
supabase/migrations/20260101000041_enterprise_dispatch_delivery.sql
```

Extends:

- `dispatches` — priority, weight, shipment QR, POD flag  
- `fleet_vehicles` — GPS, VIN, capacity m³  

Adds `dsp_*` tables: drivers, requests/lines, routes/stops, loading, GPS, POD, exceptions, returns, documents, notifications, AI, bays, audit.

Uses existing: `dispatches`, `dispatch_items`, `fleet_vehicles`, `sales_orders`, `support_tickets`.

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/dispatch` | Hub KPIs |
| `/dashboard/dispatch/requests` | Dispatch requests CRUD |
| `/dashboard/dispatch/planning` | Assign vehicles/drivers/bays |
| `/dashboard/dispatch/fleet` | Fleet registry |
| `/dashboard/dispatch/drivers` | Driver profiles |
| `/dashboard/dispatch/routes` | AI multi-stop optimize |
| `/dashboard/dispatch/loading` | QR load verify + seal |
| `/dashboard/dispatch/tracking` | Live GPS map |
| `/dashboard/dispatch/pod` | Proof of delivery |
| `/dashboard/dispatch/exceptions` | Failures → Service Desk |
| `/dashboard/dispatch/returns` | RMA · restock · credit |
| `/dashboard/dispatch/documents` | DN · BOL · waybill HTML |
| `/dashboard/dispatch/portal` | Customer track |
| `/dashboard/dispatch/mobile` | Driver PWA guide |
| `/dashboard/dispatch/analytics` | OTD · utilization |
| `/dashboard/dispatch/ai` | AI assistant |
| `/dashboard/dispatch/legacy` | Classic SO dispatch list |

## Permissions

`dsp.view` · `dsp.manage` · `dsp.operate` · `dsp.approve` · `dsp.ai` · `dsp.track`  
(+ legacy `dispatch.view` / `dispatch.manage`)

## Library

`src/lib/dispatch/`

- `routing.ts` — nearest-neighbor multi-stop optimize, vehicle recommend  
- `service.ts` — request, assign, load, dispatch, POD, exception, return, GPS, docs, notify  
- `documents.ts` — POD & dispatch note HTML  
- `ai.ts` — insights & delay prediction  

## Operations

1. Apply migration `00041`.  
2. Confirm seed drivers, requests, route, GPS, bays.  
3. Open **Dispatch** hub → Requests → Planning → Routes → Loading → Dispatch.  
4. Capture POD; track via Customer Portal.  
