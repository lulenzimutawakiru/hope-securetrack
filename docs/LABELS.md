# Advanced Labels Platform

Enterprise label lifecycle for SecureTrack ERP — product authentication, cartons, pallets, shipping, shelf/bin, GS1 and security labels.

## Hub

`/dashboard/labels` — command center with stats, quick links, batches, AI insights, and full module menu.

## Legacy auth sheet

`/dashboard/labels/auth-sheet` — original batch QR verification label sheet (ream/carton) wired to production QR codes and printers.

## Capabilities

| Area | Features |
|------|----------|
| **Design** | Templates, formats/sizes, field layout, merge variables, categories |
| **Codes** | Barcode library, GS1 config, security features |
| **Production** | Batches, instances, print jobs, automation rules, reprints, approvals |
| **Types** | Product, carton, pallet, shipping, shelf/bin, compliance |
| **Stock** | Materials, media stock, printer profiles, Niimbot link |
| **Analytics** | Reports, analytics, AI assistant, insights |
| **System** | Documents, notifications, audit, settings |

## Permissions

- `lbl.view` · `lbl.manage` · `lbl.design` · `lbl.print`
- `lbl.approve` · `lbl.security` · `lbl.ai` · `lbl.admin`

Also uses existing `printing.create` for nav access compatibility.

## Data model (`lbl_*`, migration 00060)

formats, categories, templates, fields, variables, materials, stock, barcodes, gs1, security, rules, batches, instances, jobs, reprints, approvals, shipping, pallet, shelf, compliance, printer_profiles, documents, notifications, settings, ai_insights, audit_log

## Lib

`src/lib/lbl/` — menu, entities, crud, service, ai, types  
Auth helpers remain in `src/lib/labels.ts` (LabelData, verify hint).

## Integrations

- Print Ops (`/dashboard/print`) — designer, Niimbot, codes
- QR Codes, Packaging, Production / MES labels
