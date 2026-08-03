# Document print & download — SecureTrack ERP

## Features

Every supported business document can be:

1. **Printed** — opens a print-ready window (use **Save as PDF** in the browser print dialog)
2. **Downloaded as HTML** — offline archive; open and print later
3. **Exported as CSV** — line items for Excel / finance tools

## Shared library

- `src/lib/documents.ts` — HTML builder, print, download HTML/CSV
- `src/components/documents/document-actions.tsx` — Print / Export UI control

## Documents supported

| Document | Module |
|----------|--------|
| Tax Invoice | `/dashboard/invoices` |
| Purchase Order | `/dashboard/procurement/orders` |
| Goods Received Note | `/dashboard/inventory/grn` |
| Delivery Note / Dispatch | `/dashboard/dispatch` |

## Invoice CRUD

| Action | How |
|--------|-----|
| **Create** | Invoice from sales order |
| **Read / View** | Eye icon → lines, totals, print |
| **Update** | Pencil → status, due date, notes |
| **Delete** | Draft/void only (trash) |
| **Void** | Ban icon on issued invoices |
| **Payment** | Record payment (method + amount) |
| **Print / PDF / CSV** | Document actions on each row |

## Product CRUD

Create, edit, activate/deactivate, delete on `/dashboard/products`.

## PO CRUD extras

Send, acknowledge, cancel, delete draft/cancelled, print/export.

## Tip for “PDF”

In the print dialog, choose **Microsoft Print to PDF** or **Save as PDF** — no server PDF engine required.
