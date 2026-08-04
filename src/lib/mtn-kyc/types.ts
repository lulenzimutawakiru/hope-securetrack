/**
 * MTN Customer KYC Verification API (Swagger 2.0 · v1.0.2)
 * basePath: /v1/kycVerification/
 */

export type MtnKycIdentifierKind = "msisdn" | "bvn";

export type MtnKycVerifyInput = {
  /** Unique tracker (UUID recommended) */
  transactionId: string;
  /** e.g. NIBSS */
  targetSystem?: string;
  /** Bank Verification Numbers */
  bvns?: string[];
  /** Mobile numbers (MSISDN) */
  msisdns?: string[];
};

/** Flexible customer row — MTN payload fields vary by market */
export type MtnKycCustomer = {
  msisdn?: string | null;
  bvn?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  fullName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  kycStatus?: string | null;
  matchStatus?: string | null;
  [key: string]: unknown;
};

export type MtnKycMultiResponse = {
  statusCode?: string;
  statusMessage?: string;
  transactionId?: string;
  customers?: MtnKycCustomer[];
  data?: MtnKycCustomer[] | Record<string, unknown>;
  [key: string]: unknown;
};

export type MtnKycErrorPayload = {
  statusCode?: string;
  statusMessage?: string;
  message?: string;
  error?: string;
  [key: string]: unknown;
};

/** MADAPI statusCode on error bodies (swagger examples) */
export type MadapiStatusCode =
  | "0000" // success
  | "1000" // 404 Not Found
  | "3000" // 405/406/415 Method Not Allowed / Not Acceptable / Unsupported Media
  | "4000" // 401 Unauthorized
  | "4001" // 403 Forbidden
  | "4004" // 404 alternate
  | "5000" // 400 Bad Request
  | "5001" // validation
  | string;

export type MtnKycCallResult =
  | {
      ok: true;
      status: number;
      /** MADAPI statusCode when present (e.g. 0000) */
      madapiCode: string;
      body: MtnKycMultiResponse;
      raw: unknown;
    }
  | {
      ok: false;
      status: number;
      madapiCode: string;
      error: string;
      /** auth | client | not_found | server | unknown */
      severity?: string;
      body?: MtnKycErrorPayload | null;
      raw?: unknown;
    };

export type MtnKycAuditRow = {
  id: string;
  company_id: string;
  transaction_id: string;
  target_system: string | null;
  identifier_kind: string;
  identifiers: string[];
  http_status: number | null;
  status_code: string | null;
  success: boolean;
  response_summary: Record<string, unknown> | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
};
