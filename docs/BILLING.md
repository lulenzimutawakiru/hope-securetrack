# Enterprise Invoicing & Billing Platform

Hope SecureTrack module for **invoice management, AR, tax, payments, recurring billing, and revenue recognition**.

## Navigation

**Dashboard → Billing** (`/dashboard/billing`)

Also linked from Finance AR and legacy Invoices page.

## Revenue lifecycle

Customer → Quotation → Sales Order → Delivery → Invoice → Approval → Delivery → Payment → Reconciliation → Reporting

## Modules

| Module | Path |
|--------|------|
| Hub | `/dashboard/billing` |
| Invoices | `.../invoices` |
| Customers | `.../customers` |
| Payments | `.../payments` |
| Recurring | `.../recurring` |
| Credit Notes | `.../credit-notes` |
| Debit Notes | `.../debit-notes` |
| Tax | `.../tax` |
| Aging | `.../aging` |
| Designer | `.../designer` |
| AI Assistant | `.../ai` |
| Numbering | `.../numbering` |
| Gateways | `.../gateways` |
| Reminders | `.../reminders` |
| Revenue | `.../revenue` |
| Reconcile | `.../reconcile` |
| Reports | `.../reports` |

## Database

Migration: `supabase/migrations/20260101000025_enterprise_invoicing_billing.sql`

Extends `customers` and `invoices`; adds `bill_*` tables for sequences, tax, templates, recurring, notes, gateways, dunning, revenue, reconciliation.

Permissions: `billing.view`, `billing.manage`, `billing.approve`, `billing.collect`, `billing.tax`, `billing.design`, `billing.recurring`, `billing.ai`

## Libraries

`src/lib/billing/` — types, tax engine, numbering, invoice HTML/print, service (create/approve/pay/recurring), AI drafts

## Advanced (v2)

Migration: `supabase/migrations/20260101000026_billing_enterprise_advanced.sql`

- Credit control, sales blocks, credit approvals  
- Contract / SLA / milestone billing  
- Project T&M + expenses  
- Manufacturing / dispatch → invoice  
- Multi-level approvals + digital signatures  
- Customer portal (`/portal/{token}`)  
- Payment intents (MTN, Airtel, Stripe, PayPal, Flutterwave, Pesapal, cheque, POS, wallet)  
- Communications log  
- CFO dashboard + AI risk / duplicates / forecast  

## Apply migrations

Run in Supabase SQL Editor (in order):

1. `supabase/migrations/20260101000025_enterprise_invoicing_billing.sql`  
2. `supabase/migrations/20260101000026_billing_enterprise_advanced.sql`
