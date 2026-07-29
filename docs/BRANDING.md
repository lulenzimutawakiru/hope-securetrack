# Enterprise Branding & Corporate Identity (DAM)

Hope SecureTrack — centralized multi-company brand identity, digital asset management, document templates, product/packaging branding, approvals, and compliance.

## Scope

| Domain | Capability |
|--------|------------|
| Multi-company | Independent logos, colors, fonts, templates per brand profile |
| Identity | Brand profiles, logos (primary/dark/light/watermark), colors, typography |
| Guidelines | Digital brand book sections (logo, color, type, photo, voice, forbidden) |
| DAM | Assets with tags, versions, expiry, approval, download tracking |
| Documents | Template engine (header/body/footer tokens) for invoice, PO, HR, labels |
| Designer | Canvas sizes + layout_json blocks + live HTML preview |
| Product branding | Packaging notes, QR auth, security print, hologram zones |
| Email / UI | Signatures, UI themes synced to `system_settings` |
| Workflow | Marketing → Brand Manager → Management → Published |
| Compliance | Scan templates/assets/colors; log open issues |
| AI | Insights, marketing copy, email signature helpers |
| Analytics | Assets, templates, downloads, pending, violations, audit |

## Migration

Apply:

```text
supabase/migrations/20260101000033_enterprise_branding_dam.sql
```

Seeds Hope Design Group primary brand, palette, fonts, guidelines, assets, and sample templates.

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/branding` | Hub + stats + module grid |
| `/dashboard/branding/profiles` | Multi-company brand profiles |
| `/dashboard/branding/logos` | Logo variants |
| `/dashboard/branding/colors` | Palette · HEX/CMYK · contrast |
| `/dashboard/branding/typography` | Font roles |
| `/dashboard/branding/guidelines` | Brand book |
| `/dashboard/branding/assets` | DAM library |
| `/dashboard/branding/templates` | Document templates + preview |
| `/dashboard/branding/designer` | Layout canvas preview |
| `/dashboard/branding/products` | Product / packaging branding |
| `/dashboard/branding/email` | Email signatures |
| `/dashboard/branding/themes` | ERP UI themes |
| `/dashboard/branding/approvals` | Approval workflow |
| `/dashboard/branding/compliance` | Scan + resolve issues |
| `/dashboard/branding/analytics` | Usage dashboard |
| `/dashboard/branding/ai` | AI brand assistant |

Legacy settings branding: `/dashboard/settings/branding` (simple keys; themes sync into `system_settings`).

## Permissions

- `brand.view` / `brand.manage`
- `brand.design` — templates & designer
- `brand.approve` / `brand.publish`
- `brand.ai` / `brand.assets`

Seeded to super admin, MD, operations, auditor, sales manager, HR manager.

## Tables

`brand_profiles`, `brand_logos`, `brand_colors`, `brand_fonts`, `brand_guidelines`, `brand_assets`, `brand_templates`, `brand_product_profiles`, `brand_email_signatures`, `brand_ui_themes`, `brand_branch_overrides`, `brand_approvals`, `brand_compliance_issues`, `brand_audit`

RLS: company-scoped via `user_company_id()` / super admin.

## Library

`src/lib/branding/`

- `colors.ts` — HEX normalize, RGB/CMYK/HSL, contrast, WCAG AA
- `templates.ts` — token apply, document HTML, default layout
- `compliance.ts` — template/color/expiry scans
- `ai.ts` — insights, marketing copy, signatures
- `service.ts` — CRUD helpers, approvals, compliance run, theme sync

## CRUD+

Profiles, logos, colors, fonts, guidelines, assets, templates, products, email signatures, themes support create/read/update/soft-delete (where applicable). Approvals advance stages. Templates/assets open approval on create. Audit log on key actions.

## ERP integration

- **Finance / Sales / Procurement** — document templates (invoice, PO, quotation)
- **HR / WID** — ID card and HR document templates
- **Production / Packaging** — product brand profiles, security print flags
- **Settings** — UI theme sync to branding keys
- **Email** — branded signatures for outbound

## Operations

1. Apply migration `00033` in Supabase.
2. Confirm seed brand profile and colors for the primary company.
3. Upload real logo URLs into `brand_logos` / DAM.
4. Publish templates before ERP document modules consume them.
5. Run compliance scan after major brand changes.
6. Activate a UI theme and sync to settings for login/dashboard tokens.
