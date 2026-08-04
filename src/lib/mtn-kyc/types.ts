/**
 * MTN Customer KYC Verification API (Swagger 2.0 · v1.0.2)
 * basePath: /v1/kycVerification/
 */

export type MtnKycIdentifierKind = "msisdn" | "bvn";

/** MADAPI requestType when targetSystem is NIBSS (POST /customers) */
export type MtnKycRequestType =
  | "FACE_MATCH"
  | "FINGERPRINT"
  | "BVN"
  | "MSISDN"
  | string;

export type MtnKycCustomerInput = {
  msisdn?: string;
  bvn?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
  gender?: string;
  /** Base64 face image for FACE_MATCH */
  faceImage?: string;
  /** Base64 fingerprint for FINGERPRINT */
  fingerprintImage?: string;
  [key: string]: unknown;
};

export type MtnKycVerifyInput = {
  /** Unique tracker (UUID recommended) */
  transactionId: string;
  /** e.g. NIBSS */
  targetSystem?: string;
  /** Bank Verification Numbers (GET) */
  bvns?: string[];
  /** Mobile numbers MSISDN (GET) */
  msisdns?: string[];
};

/** POST /customers — array of customer records + optional biometrics */
export type MtnKycVerifyBodyInput = {
  transactionId: string;
  targetSystem?: string;
  /**
   * Face match or fingerprint verification when targetSystem is NIBSS.
   * Swagger: query param requestType
   */
  requestType?: MtnKycRequestType;
  /** FINGERPRINT | FINGERPRINT_DOB when targetSystem is NIBSS */
  verificationType?: string;
  /** Optional device identifier (CustomerKYCVerificationMultipleRequest.deviceId) */
  deviceId?: string;
  customers: MtnKycCustomerInput[];
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

/** POST /customers/{customerId} - single-customer KYC verification (BasicKYCRequestData). */
export type MtnKycVerifySingleInput = {
  transactionId: string;
  /** MSISDN (E.123), email, or other customer identifier */
  customerId: string;
  targetSystem?: string;
  /** Required query flag: partner has acquired customer consent */
  isConsentVerified: boolean;
  /** BasicKYCRequestData fields (id, firstName, lastName, otherNames, ...) */
  body: Record<string, unknown>;
};

/** GET /customers/{customerId} - confirm MSISDN is active on bank/MTN + hashed MSISDN. */
export type MtnKycCheckMsisdnInput = {
  transactionId: string;
  customerId: string;
  targetSystem?: string;
  /** BANK | HASHCODE | EVALIDATOR | WinBack | VALENTINE_PROMO */
  verificationType?: string;
  /** Bank short code */
  externalCode?: string;
  startDate?: string;
  endDate?: string;
};

/** POST /customers/{customerId}/kycScore|nameScore|addressScore */
export type MtnKycScoreInput = {
  transactionId: string;
  customerId: string;
  body: Record<string, unknown>;
};

/** POST /customers/{customerId}/biometric/verify - FaceMatchingRequest */
export type MtnKycBiometricInput = {
  transactionId: string;
  customerId: string;
  targetSystem?: string;
  /** FINGERPRINT_MATCH when targetSystem is NIBSS */
  requestType?: string;
  /** FINGERPRINT_PHONENUMBER when targetSystem is NIBSS */
  verificationType?: string;
  /** FaceMatchingRequest (email, binaryAttachment[], uploadId, description, deviceId, serialNumber, correlationId) */
  body: Record<string, unknown>;
};

/** POST /biometric-roc/customers/identityStatus - ROC enroll identity status */
export type MtnKycIdentityStatusInput = {
  transactionId: string;
  body: {
    customerId: string;
    agentId?: string;
    channelId?: string;
  };
};
