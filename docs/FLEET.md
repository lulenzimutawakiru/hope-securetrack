# Enterprise Fleet & Transport Management Platform

SecureTrack ERP module covering full **FMS + TMS + GPS + Fuel + Maintenance + Drivers + POD + AI**.

## Capabilities

- Vehicle lifecycle (registry, categories, brands, models, documents, photos, QR/asset tags)
- Driver management linked to HR identity (licenses, medicals, training, violations, performance, attendance)
- Live GPS map, geofences, telematics, IoT sensors
- Trip requests → approval → assignment → dispatch → POD → closure
- Fuel stations, cards, requests, issuance, consumption analytics
- Preventive / corrective maintenance, work orders, workshops, mechanics, spare parts
- Tyres & batteries, insurance, road licenses, inspections, accidents, claims
- Cost tracking with finance posting flags
- AI Fleet Assistant (maintenance prediction, fuel anomalies, utilization, safety)
- Reports CSV export, approvals, notifications, audit log

## Routes

Base: `/dashboard/fleet`

See `FLEET_MENU` in `src/lib/fleet/menu.ts` for the complete navigation tree (70+ pages).

## Permissions

| Slug | Description |
|------|-------------|
| `fleet.view` | View fleet platform |
| `fleet.manage` | Create/edit entities |
| `fleet.drivers` | Driver management |
| `fleet.fuel` | Fuel management |
| `fleet.maintenance` | Maintenance & workshop |
| `fleet.dispatch` | Trips, dispatch, POD |
| `fleet.track` | GPS tracking |
| `fleet.approve` | Approvals |
| `fleet.ai` | AI assistant |
| `fleet.admin` | Full admin |

## Database

Migration: `supabase/migrations/20260101000054_enterprise_fleet_transport.sql`

Extends existing `fleet_vehicles`, `fleet_fuel_logs`, `fleet_maintenance` and adds enterprise tables (`fleet_drivers`, `fleet_trips`, `fleet_gps_*`, `fleet_work_orders`, …).

All company-scoped tables use RLS with `user_company_id()`.

## Integration points

- **HR / Identity**: `fleet_drivers.employee_id`, `user_id`
- **Dispatch module**: complementary to `/dashboard/dispatch` (ops); Fleet is the full asset/lifecycle layer
- **Finance**: `fleet_costs.finance_posted`, GL account fields
- **Inventory**: spare parts consumption
- **Communications**: customer delivery / delay notifications (via Comm hub)
- **Media**: vehicle photos, POD signatures, document file URLs via Storage

## Lib

- `src/lib/fleet/crud.ts` — generic CRUD + audit + CSV
- `src/lib/fleet/entities.ts` — entity field configs
- `src/lib/fleet/service.ts` — dashboard stats, live positions
- `src/lib/fleet/ai.ts` — rule-based AI insights
- `src/components/fleet/fleet-entity-page.tsx` — full CRUD UI
