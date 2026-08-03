# Enterprise Printer Management & Printing Platform

SecureTrack ERP — centralized print server, printer registry, label designer, QR/barcode engine, Niimbot BLE, security printing, document print profiles, industrial queue, and batch automation.

## Scope

| Domain | Capability |
|--------|------------|
| Registry | Full device inventory (brand, type, IP, BLE, location, default) |
| Brands | HP, Canon, Epson, Zebra, Niimbot, TSC, Evolis, Star, … |
| Niimbot | BLE discovery, 50×30 labels, test queue, models B21/D11/… |
| Designer | Layers, elements, variables, live HTML preview |
| Codes | QR purposes, Code128, EAN-13 validate, Data Matrix presets |
| Security | Watermark, microtext, holo/UV placeholders, tamper QR, SIG hash |
| Queue | Priority jobs, printing/completed/failed, reprint/retry |
| Documents | Invoice, PO, GRN, delivery, receipt profiles |
| Batches | Bulk serial generation + multi-job enqueue |
| Media | Label sizes, stock, reorder alerts |
| Service | Maintenance history per printer |
| AI | Offline devices, backlog, media, routing tips |

## Migrations

```text
supabase/migrations/20260101000035_enterprise_print_platform.sql
supabase/migrations/20260101000036_enterprise_print_advanced.sql
```

**00035** — registry extensions, templates, queue, security, Niimbot seed.  
**00036** — print servers, automation, consumables, quotas, ID/product/inventory jobs, secure PDFs, alerts, enhanced queue fields (PIN, retries, failover).

Requires base schema (`printers`, `print_jobs`) from `00001`.

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/print` | Enterprise hub |
| `/dashboard/print/registry` | Printer inventory |
| `/dashboard/print/server` | Print servers · load balance · schedules |
| `/dashboard/print/queue` | Job queue · retry · reprint |
| `/dashboard/print/release` | Secure PIN release |
| `/dashboard/print/automation` | ERP event → auto print |
| `/dashboard/print/designer` | Label designer |
| `/dashboard/print/templates` | Templates + preview |
| `/dashboard/print/product-labels` | Manufacturing QR labels (high volume) |
| `/dashboard/print/inventory-labels` | Shelf · bin · pallet |
| `/dashboard/print/id-cards` | Staff · visitor · RFID |
| `/dashboard/print/niimbot` | Niimbot BLE hub |
| `/dashboard/print/codes` | QR & barcode engine |
| `/dashboard/print/security` | Security print profiles |
| `/dashboard/print/secure-pdf` | Anti-copy secure documents |
| `/dashboard/print/documents` | ERP document profiles |
| `/dashboard/print/batches` | High-volume batch (pause/resume) |
| `/dashboard/print/media` | Media stock |
| `/dashboard/print/consumables` | Toner · ribbon · alerts |
| `/dashboard/print/quotas` | Dept quotas · printer access |
| `/dashboard/print/service` | Service history |
| `/dashboard/print/mobile` | Mobile/remote guide |
| `/dashboard/print/analytics` | Fleet analytics |
| `/dashboard/print/ai` | AI assistant |

Legacy: `/dashboard/printers`, `/dashboard/printing`, `/dashboard/labels`

## Permissions

- `print.view` / `print.manage` / `print.submit` / `print.operate`
- `print.design` / `print.security` / `print.admin` / `print.ai`
- Legacy: `printing.*`, `printers.manage`

## Library

`src/lib/print/` — types, codes, designer, security, AI, service, pdf, automation  
`src/lib/niimbot.ts` — Web Bluetooth discovery (re-exported)

### High-volume batch

`createHighVolumeBatch()` tracks up to **100,000** labels on the batch record, generates serials + QR payloads, and enqueues the first **500** jobs from the browser (production print agents continue the remainder). Pause/resume supported on batches.

### Secure release

Jobs with `secure_release` are held with a 4-digit PIN until released from **Secure Release** (desktop or mobile).

### Automation events

`production_complete`, `grn_received`, `invoice_approved`, `po_issued`, `employee_hired`, `id_approved`, `asset_registered`, `shipment_dispatched` → matching `prt_automation_rules`.

## Operations

1. Apply migrations `00035` and `00036`.  
2. Open **Print Ops → Registry** and confirm seeded printers.  
3. Confirm **Print Server** agents and mapped shares.  
4. Pair Niimbot via **Niimbot Hub** (Chrome/Edge HTTPS).  
5. Configure **Automation** for production/GRN/invoice.  
6. Run **Product Labels** or **Batch Print** for manufacturing volumes.  
7. Monitor **Consumables**, **Quotas**, and **AI** insights.  

