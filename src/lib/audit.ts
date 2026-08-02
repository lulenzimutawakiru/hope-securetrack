/**
 * Client‑side event logging to the audit endpoint.
 * All logging is best‑effort; no UI feedback on failure.
 */
const AUDIT_ENDPOINT = "/api/audit/log";

export interface AuditPayload {
  event: string;
  details?: Record<string, unknown>;
  userId?: string;
  companyId?: string;
}

export async function logClientEvent(payload: AuditPayload) {
  try {
    await fetch(AUDIT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        clientTimestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Silently fail to avoid breaking UI flow
  }
}

export async function reportError(error: Error & { digest?: string }) {
  await logClientEvent({
    event: "client_error",
    details: {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    },
  });
}
