# Enterprise Sales & Revenue Management — Hope Design Group Ltd

**Industry:** Security Printing · Paper Manufacturing · Engineering  
**Deployment:** Cloud · On-Premise · Hybrid · Offline-capable foundation  

## Quote-to-cash lifecycle

```
Lead → Opportunity → Quotation → Customer approval → Sales Order
  → Credit approval → Inventory / Production → Warehouse picking
  → Delivery → Invoice → Payment → After-sales support
```

## Application map

| Area | Route |
|------|--------|
| Sales command center | `/dashboard/sales` |
| Pipeline (leads & opps) | `/dashboard/sales/pipeline` |
| Quotations | `/dashboard/sales/quotations` |
| Sales orders | `/dashboard/sales/orders` |
| Credit management | `/dashboard/sales/credit` |
| Returns (RMA) | `/dashboard/sales/returns` |
| Commissions | `/dashboard/sales/commissions` |
| Invoicing | `/dashboard/invoices` |
| Dispatch / delivery | `/dashboard/dispatch` |
| Product verification | `/verify` |

## Data model highlights

- Extended `customers` (credit, risk, territory, tax)
- `sales_territories`
- `sales_leads`, `sales_opportunities`
- `quotations`, `quotation_lines` → convert to `sales_orders`
- `credit_reviews` (auto on over-limit orders)
- Extended `sales_orders` (order type, credit flags, production flag)
- `sales_returns`, `sales_return_lines`
- `sales_commissions`
- `sales_insights` (AI recommendations store)
- `support_tickets` (after-sales foundation)

## Pricing modes supported in model

Dealer / wholesale / retail / government / export prices are product-level extensible via product `specifications` JSONB and order line unit prices.

## Integrations

| Module | Link |
|--------|------|
| Inventory / Warehouse | Stock visibility, dispatch |
| Manufacturing | `requires_production` on orders |
| Finance / AR | Invoices, payments, credit |
| SecureTrack QR | Product authenticity for customers |
| WFM | Sales rep capacity (future) |

## Currency default

UGX (Uganda) for domestic ops; multi-currency fields present on documents.
