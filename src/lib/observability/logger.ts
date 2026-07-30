/**
 * Structured logging with correlation IDs (OpenTelemetry-friendly fields).
 * Does not require OTEL exporter — ships JSON to stdout for platform log drains.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  correlationId?: string;
  tenantId?: string | null;
  companyId?: string | null;
  userId?: string | null;
  module?: string;
  action?: string;
  durationMs?: number;
  [key: string]: unknown;
};

function emit(level: LogLevel, message: string, ctx: LogContext = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    service: "securetrack-erp",
    ...ctx,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (message: string, ctx?: LogContext) => emit("debug", message, ctx),
  info: (message: string, ctx?: LogContext) => emit("info", message, ctx),
  warn: (message: string, ctx?: LogContext) => emit("warn", message, ctx),
  error: (message: string, ctx?: LogContext) => emit("error", message, ctx),
};

export function newCorrelationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `corr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function correlationFromRequest(req: Request): string {
  return (
    req.headers.get("x-correlation-id") ||
    req.headers.get("x-request-id") ||
    newCorrelationId()
  );
}
