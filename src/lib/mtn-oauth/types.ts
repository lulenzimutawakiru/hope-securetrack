/**
 * MTN MADAPI OAuth2 (Swagger v1.1) - shared types.
 *
 * The raw access token is NEVER exposed through the API or UI.
 * Only a sha256 hash + expiry metadata are persisted/returned.
 */

export type MtnOauthTokenResult =
  | {
      ok: true;
      status: number;
      tokenType: string;
      /** Seconds until expiry (swagger expires_in, string like "3599") */
      expiresInSeconds: number | null;
      issuedAt: string | null;
      /** sha256 of the token - safe to store/return, not the token */
      tokenHash: string;
      tokenAvailable: true;
      summary: Record<string, unknown>;
      raw: unknown;
    }
  | {
      ok: false;
      status: number;
      error: string;
      /** auth | client | server | unknown */
      severity?: string;
      body?: Record<string, unknown> | null;
      raw?: unknown;
    };

export type MtnOauthAuditRow = {
  id: string;
  company_id: string;
  transaction_id: string | null;
  http_status: number | null;
  status_code: string | null;
  success: boolean;
  token_hash: string | null;
  expires_at: string | null;
  issued_at: string | null;
  client_id: string | null;
  response_summary: Record<string, unknown> | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
};