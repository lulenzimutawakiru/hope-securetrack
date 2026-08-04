/**
 * MADAPI canonical status codes for MTN KYC Verification (Swagger examples).
 *
 * Note: Swagger descriptions often say "canonical code for success" on error
 * schemas — that is a template typo. The *examples* define the real codes:
 *   400 → 5000, 401 → 4000, 403 → 4001, 404 → (not found family)
 */

export type MadapiSeverity = "success" | "client" | "auth" | "not_found" | "server" | "unknown";

export type MadapiCodeInfo = {
  code: string;
  httpHint?: number;
  severity: MadapiSeverity;
  label: string;
  description: string;
};

/** Known codes from swagger examples + common MADAPI patterns */
export const MADAPI_STATUS_CODES: Record<string, MadapiCodeInfo> = {
  "0000": {
    code: "0000",
    httpHint: 200,
    severity: "success",
    label: "Success",
    description: "Request completed successfully",
  },
  "0": {
    code: "0",
    httpHint: 200,
    severity: "success",
    label: "Success",
    description: "Request completed successfully",
  },
  "4000": {
    code: "4000",
    httpHint: 401,
    severity: "auth",
    label: "Unauthorized",
    description: "Authentication failed (invalid or missing credentials)",
  },
  "4001": {
    code: "4001",
    httpHint: 403,
    severity: "auth",
    label: "Forbidden",
    description: "Authenticated but not allowed to perform this operation",
  },
  "4004": {
    code: "4004",
    httpHint: 404,
    severity: "not_found",
    label: "Not Found",
    description: "Customer or resource was not found",
  },
  "5000": {
    code: "5000",
    httpHint: 400,
    severity: "client",
    label: "Bad Request",
    description: "Invalid request parameters or payload (MADAPI 5000)",
  },
  "5001": {
    code: "5001",
    httpHint: 400,
    severity: "client",
    label: "Validation Error",
    description: "Request failed business or field validation",
  },
};

/** HTTP status → default MADAPI code when body omits statusCode */
export const HTTP_TO_DEFAULT_MADAPI: Record<number, string> = {
  200: "0000",
  400: "5000",
  401: "4000",
  403: "4001",
  404: "4004",
  500: "5000",
  502: "5000",
  503: "5000",
};

export function normalizeMadapiCode(code: unknown): string {
  if (code == null) return "";
  return String(code).trim();
}

export function isMadapiSuccessCode(code: unknown): boolean {
  const c = normalizeMadapiCode(code);
  if (!c) return false;
  const info = MADAPI_STATUS_CODES[c];
  if (info) return info.severity === "success";
  // Unknown codes: only treat classic success tokens as OK
  return c === "0000" || c === "0" || c.toUpperCase() === "SUCCESS";
}

export function resolveMadapiCode(
  httpStatus: number,
  body?: { statusCode?: unknown; status_code?: unknown } | null
): string {
  const fromBody = normalizeMadapiCode(
    body?.statusCode ?? body?.status_code
  );
  if (fromBody) return fromBody;
  return HTTP_TO_DEFAULT_MADAPI[httpStatus] || String(httpStatus || "unknown");
}

export function describeMadapiError(
  httpStatus: number,
  body?: Record<string, unknown> | null
): {
  code: string;
  label: string;
  message: string;
  severity: MadapiSeverity;
} {
  const code = resolveMadapiCode(httpStatus, body);
  const info = MADAPI_STATUS_CODES[code];
  const statusMessage = String(
    body?.statusMessage ||
      body?.status_message ||
      body?.message ||
      body?.error ||
      ""
  ).trim();

  if (info) {
    return {
      code,
      label: info.label,
      message: statusMessage
        ? `${info.label} (${code}): ${statusMessage}`
        : `${info.label} (MADAPI ${code}): ${info.description}`,
      severity: info.severity,
    };
  }

  // Generic by HTTP when code unknown
  const httpLabel =
    httpStatus === 400
      ? "Bad Request"
      : httpStatus === 401
        ? "Unauthorized"
        : httpStatus === 403
          ? "Forbidden"
          : httpStatus === 404
            ? "Not Found"
            : `HTTP ${httpStatus}`;

  return {
    code: code || String(httpStatus),
    label: httpLabel,
    message: statusMessage
      ? `${httpLabel}: ${statusMessage}`
      : `${httpLabel} from MTN KYC`,
    severity:
      httpStatus === 401 || httpStatus === 403
        ? "auth"
        : httpStatus === 404
          ? "not_found"
          : httpStatus >= 500
            ? "server"
            : httpStatus >= 400
              ? "client"
              : "unknown",
  };
}

/** Map MADAPI severity to ERP HTTP status for our API responses */
export function erpHttpFromMadapi(
  httpStatus: number,
  code: string
): number {
  const info = MADAPI_STATUS_CODES[code];
  if (info?.httpHint) return info.httpHint;
  if (httpStatus >= 400) return httpStatus;
  return 502;
}
