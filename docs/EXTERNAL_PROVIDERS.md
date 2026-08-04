# External Providers Integration

SecureTrack ERP multi-provider integration layer for **payments, SMS, WhatsApp, push, maps, CAPTCHA, OCR, QStash, and SIEM delivery**.

## Architecture

```
UI / Portal / Worker
  → createPaymentIntent / notifyUsers / maps API / OCR
  → src/lib/providers/*
  → Provider HTTP APIs (sandbox when keys missing)
  → Webhooks → completePaymentIntent / service desk
```

Libraries live under `src/lib/providers/`.

| Area | Module |
|------|--------|
| Config | `config.ts`, `env.providers` |
| Payments | `payments/` — MTN MoMo, Airtel, Flutterwave, Pesapal, Stripe |
| Comms | `comms/` — Africa's Talking, WhatsApp Cloud, FCM/OneSignal |
| Maps | `maps/mapbox.ts` |
| Jobs | `queue/qstash.ts` + existing `job_queue` |
| Security | `security/captcha.ts` (Turnstile) |
| SIEM | `siem/deliver.ts` + `audit/siem.flushSiemOutbox` |
| OCR | `docs/ocr.ts` |

## UI

**Dashboard → Integrations → External Providers**  
`/dashboard/integrations/providers`

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/v2/integrations/providers` | Status matrix + test actions |
| POST | `/api/v2/integrations/maps` | Geocode / directions |
| POST | `/api/v2/integrations/captcha/verify` | Turnstile verify |
| POST | `/api/v2/integrations/ocr` | Document extract |
| POST | `/api/public/billing/webhooks/*` | Payment settlement |
| GET/POST | `/api/public/webhooks/whatsapp` | Meta verify + inbound |

### Payment webhooks

| Provider | Path |
|----------|------|
| Generic | `/api/public/billing/webhooks/generic` |
| MTN MoMo | `/api/public/billing/webhooks/mtn-momo` |
| Flutterwave | `/api/public/billing/webhooks/flutterwave` |
| Stripe | `/api/public/billing/webhooks/stripe` |
| Pesapal | `/api/public/billing/webhooks/pesapal` |

Generic & fallback auth: header `X-Webhook-Secret: $BILLING_WEBHOOK_SECRET`.

## Environment

See `.env.example` section **External providers**. Minimum for local sandbox:

```bash
PAYMENT_SANDBOX=true
PROVIDERS_SANDBOX=true
```

Without live keys, all providers return **sandbox success** so billing intents, SMS/WhatsApp queues, maps, and OCR still work in demos.

### Production checklist

1. Set real keys for each rail you enable (MoMo / Flutterwave / Pesapal recommended for UG).  
2. Set `PAYMENT_SANDBOX=false` and provider-specific `*_SANDBOX=false`.  
3. Configure webhook URLs on each provider dashboard pointing at production domain.  
4. Set `BILLING_WEBHOOK_SECRET` and provider-specific secrets (Flutterwave `verif-hash`, Stripe signing secret, WhatsApp app secret).  
5. Apply migration `20260814000001_external_providers_hub.sql`.  
6. Ensure job worker cron hits `/api/jobs/worker` (drains SMS/WhatsApp/push queue).  
7. Optional: `QSTASH_TOKEN` to schedule worker pings across serverless.

## Wiring into ERP modules

| Flow | Integration |
|------|-------------|
| Invoice pay | `createPaymentIntent` → provider collect → webhook → `completePaymentIntent` |
| Notifications | `notifyUsers` queues sms/whatsapp/push → worker → `deliverExternalChannel` |
| Dispatch / fleet | `/api/v2/integrations/maps` Mapbox geocode & directions |
| Audit SIEM | `flushSiemOutbox` HTTPS POST to HEC/webhook endpoints |
| Outbound webhooks | Integration engine real HMAC delivery |
| Login / public forms | `/api/v2/integrations/captcha/verify` |
| AP invoice capture | `/api/v2/integrations/ocr` |

## Database

Migration: `supabase/migrations/20260814000001_external_providers_hub.sql`

- `intg_provider_calls` — audit of test/live provider calls  
- `user_push_tokens` — FCM/OneSignal device tokens  
- Connector catalog seeds for marketplace

## RBAC

- View: `intg.view`, `settings.integrations`  
- Manage / test: `intg.manage`, `settings.integrations`  
- Maps: also `fleet.track`, `fleet.view`, `dispatch.view`  
- OCR: `finance.manage`, `procurement.manage`, `documents.manage`

## Related

- **SSO / SCIM:** [SSO_SCIM.md](./SSO_SCIM.md) — Entra OIDC login, SCIM user provision  
- **Push tokens:** `POST /api/v2/integrations/push-tokens`  
- **Job worker:** flushes SIEM outbox + SMS/WhatsApp/push queue on each cron tick  

## Security notes

- All provider secrets are **server-only**.  
- Payment completion requires verified webhook or `PAYMENT_SANDBOX`.  
- Webhook routes rate-limited via `ingressRateLimit`.  
- Never log raw API keys or MoMo tokens.  
- Login CAPTCHA: Turnstile widget on failed attempts (`LOGIN_CAPTCHA_ALWAYS=true` to force).
