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

export type MtnKycCallResult =
  | {
      ok: true;
      status: number;
      body: MtnKycMultiResponse;
      raw: unknown;
    }
  | {
      ok: false;
      status: number;
      error: string;
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
