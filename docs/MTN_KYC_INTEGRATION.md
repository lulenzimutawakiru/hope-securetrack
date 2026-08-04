# MTN Customer KYC Verification API

Swagger 2.0 · **v1.0.2** · `https://api.mtn.com/v1/kycVerification/`

## Endpoint (from MADAPI swagger)

```
GET /v1/kycVerification/customers
```

### Security (both required)

| Scheme | How |
|--------|-----|
| ApiKeyAuth | Header `X-API-Key` |
| basicAuth | HTTP Basic |

### Headers

| Name | Description | Example |
|------|-------------|---------|
| `transactionId` | Tracking id | `e938-300949-394999-39993` |
| `targetSystem` | Target system | `NIBSS` |
| `bvns` | Array of BVNs | `["BVN123455","BVN3409394"]` |

### Responses

| HTTP | MADAPI `statusCode` (example) | Meaning |
|------|-------------------------------|---------|
| 200 | `0000` | Success (`CustomerVerificationKYCMultiResponse`) |
| 400 | `5000` | Bad Request + `ErrorPayload` |
| 401 | `4000` | Unauthorized + `ErrorPayload` |
| 403 | `4001` | Forbidden + `ErrorPayload` |
| 404 | `4004` | Not Found + `ErrorPayload` |

SecureTrack maps these in `src/lib/mtn-kyc/madapi-codes.ts` and returns `madapi_code` on API errors.

## SecureTrack integration

| Piece | Path |
|-------|------|
| Client | `src/lib/mtn-kyc/` |
| API | `GET/POST /api/v2/integrations/mtn-kyc` |
| UI | `/dashboard/integrations/mtn-kyc` |
| Audit table | `intg_mtn_kyc_verifications` |
| Migration | `supabase/migrations/20260812000001_mtn_kyc_verification.sql` |

### Environment

```bash
MTN_KYC_BASE_URL=https://api.mtn.com/v1/kycVerification
MTN_KYC_API_KEY=
MTN_KYC_BASIC_USER=
MTN_KYC_BASIC_PASSWORD=
MTN_KYC_TARGET_SYSTEM=NIBSS
# Dev without credentials → sandbox mock responses (default non-prod)
MTN_KYC_SANDBOX=true
```

### RBAC

- View: `intg.view`, `crm.view`, `iam.view`, `settings.integrations`
- Verify: `intg.manage`, `crm.manage`, `iam.manage`, `settings.integrations`

### Example (ERP API)

```http
POST /api/v2/integrations/mtn-kyc
Content-Type: application/json

{
  "bvn_list": "BVN123455,BVN3409394",
  "target_system": "NIBSS"
}
```

### Apply DB

```bash
supabase db push
```
