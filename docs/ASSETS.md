# Enterprise Asset Tagging & Digital Identification

Hope SecureTrack — world-class asset identification, register, lifecycle, verification, digital twin, and intelligence platform (QR · barcode · RFID · NFC · GPS · BLE).

## Tag format

```text
HDG-{DOMAIN}-{TYPE}-{SEQUENCE}

Examples:
  HDG-IT-LAP-000001
  HDG-IT-PRN-000023
  HDG-MFG-MCH-000102
  HDG-WHS-RCK-000055
```

Configurable: company prefix, domain, type code, pad width, optional check digit.

## Migrations

```text
supabase/migrations/20260101000038_enterprise_asset_tagging.sql
```

Extends finance `fixed_assets` with optional link (`ast_assets.fixed_asset_id`). Seeds categories, sequences, tag templates, sample HDG assets with QR/barcode/RFID identifiers, and warranty alerts.

### Tables

| Table | Purpose |
|-------|---------|
| `ast_categories` | Unlimited asset categories |
| `ast_number_sequences` | Tag sequence counters |
| `ast_assets` | Master asset register |
| `ast_identifiers` | Multi-tech IDs (QR/barcode/RFID/NFC/GPS/BLE) |
| `ast_tag_templates` | Label layouts |
| `ast_assignments` | Custodian history |
| `ast_locations` | Location trail / GPS |
| `ast_documents` | Asset documents |
| `ast_maintenance_links` | PM/CM/calibration WO links |
| `ast_audits` / `ast_audit_lines` | Inventory verification |
| `ast_events` | Lifecycle timeline |
| `ast_alerts` | Warranty · movement · missing |
| `ast_ai_insights` | Stored AI recommendations |
| `ast_audit_log` | Immutable action log |

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/assets` | Hub |
| `/dashboard/assets/register` | CRUD register · bulk import/export |
| `/dashboard/assets/[id]` | Digital twin |
| `/dashboard/assets/categories` | Categories & type codes |
| `/dashboard/assets/assign` | Assign / return |
| `/dashboard/assets/audits` | Physical inventory audits |
| `/dashboard/assets/tags` | Tag designer & batch print |
| `/dashboard/assets/maintenance` | Maintenance from tags |
| `/dashboard/assets/alerts` | Alerts & acknowledgements |
| `/dashboard/assets/scan` | Scan / verify portal |
| `/dashboard/assets/analytics` | Executive / ops / finance |
| `/dashboard/assets/ai` | AI assistant |
| `/dashboard/assets/mobile` | Field / PWA guide |

Linked: Finance fixed assets · Service desk · Print Ops.

## Permissions

`ast.view` · `ast.manage` · `ast.assign` · `ast.audit` · `ast.print` · `ast.ai`

## Library

`src/lib/assets/`

- `numbering.ts` — intelligent tag generation  
- `tags.ts` — QR payload, encrypted JSON, label HTML  
- `service.ts` — register, assign, audit, maintenance, twin, bulk import  
- `ai.ts` — insights & remaining useful life  

## Identification technologies

| Tech | Use |
|------|-----|
| QR | Primary mobile scan & verification portal |
| Barcode | Code 128 / GS1-style linear |
| RFID | Passive/active UHF/HF inventory & access |
| NFC | Phone tap → profile / fault / ownership |
| GPS | Fleet & high-value mobile assets |
| BLE | Indoor beacon tracking |

## Lifecycle

Purchase → Receive → Tag → Assign → Maintain → Transfer → Audit → Retire → Dispose

## Security

- Encrypted / signed QR payloads  
- Duplicate serial detection on register  
- Soft-delete archive  
- Assignment & location event trail  
- Alert pipeline for warranty and missing assets  
- RLS multi-company via `user_company_id()`  

## Operations

1. Apply migration `00038` on Supabase.  
2. Confirm seed categories and sample tags (`HDG-IT-LAP-000001`, …).  
3. Open **Assets → Register** or import from Finance fixed assets.  
4. Print tags (**Tag Print** or Print Ops).  
5. Assign custodians; run QR/RFID **Audits**.  
6. Use **Scan** for verification; **AI** for portfolio insights.  
