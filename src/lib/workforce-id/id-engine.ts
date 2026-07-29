/**
 * Smart ID number engine
 * Examples: HDG-EMP-2026-000001, HDG-PROD-2026-000254
 */

export type SequenceConfig = {
  prefix: string;
  category_code: string;
  include_year?: boolean;
  include_location?: boolean;
  location_code?: string | null;
  pad_length?: number;
  next_value: number | string;
  check_digit?: boolean;
  separator?: string;
};

/** Luhn-style check digit for alphanumeric sequences (digits only of sequence) */
export function computeCheckDigit(numericPart: string): string {
  const digits = numericPart.replace(/\D/g, "");
  if (!digits) return "0";
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return String((10 - (sum % 10)) % 10);
}

export function formatIdentityNumber(cfg: SequenceConfig): string {
  const sep = cfg.separator ?? "-";
  const pad = cfg.pad_length ?? 6;
  const seq = String(Number(cfg.next_value)).padStart(pad, "0");
  const parts: string[] = [cfg.prefix || "HDG", cfg.category_code || "EMP"];
  if (cfg.include_year !== false) {
    parts.push(String(new Date().getFullYear()));
  }
  if (cfg.include_location && cfg.location_code) {
    parts.push(cfg.location_code);
  }
  let number = [...parts, seq].join(sep);
  if (cfg.check_digit) {
    number = `${number}${sep}${computeCheckDigit(seq)}`;
  }
  return number;
}

export function formatCredentialNumber(
  identityNumber: string,
  sequence: number
): string {
  return `CRD-${identityNumber.replace(/^HDG-/, "")}-${String(sequence).padStart(3, "0")}`;
}

export function generateSecuritySeal(): string {
  const a = Math.random().toString(36).slice(2, 6).toUpperCase();
  const b = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SEAL-${a}-${b}`;
}

export function generateAntiCopyNonce(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function generateCardSerial(batchHint = "PVC"): string {
  const y = new Date().getFullYear().toString().slice(-2);
  const r = Math.floor(Math.random() * 1e8)
    .toString()
    .padStart(8, "0");
  return `${batchHint}${y}${r}`;
}

export function generateRfidUid(): string {
  const bytes = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0")
  );
  return bytes.join(":").toUpperCase();
}

export function generateNfcUid(): string {
  const bytes = Array.from({ length: 7 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0")
  );
  return bytes.join("").toUpperCase();
}

export function generateJobNumber(seq: number): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `PRT-${ymd}-${String(seq).padStart(4, "0")}`;
}

export function generateIncidentNumber(seq: number): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `INC-${ymd}-${String(seq).padStart(4, "0")}`;
}

/** Map department / identity type to default sequence category */
export function suggestSequenceCode(
  identityType: string,
  department?: string | null
): string {
  const t = (identityType || "").toLowerCase();
  const d = (department || "").toLowerCase();
  if (t.includes("security") || d.includes("security")) return "SEC";
  if (
    t.includes("factory") ||
    t.includes("machine") ||
    t.includes("warehouse") ||
    t.includes("technician") ||
    d.includes("production") ||
    d.includes("manufacturing") ||
    d.includes("warehouse")
  )
    return "PROD";
  if (t.includes("visitor")) return "VIS";
  if (t.includes("contractor") || t.includes("consultant")) return "CTR";
  return "EMP";
}

/** Map identity/dept to default access profile code */
export function suggestAccessProfile(
  identityType: string,
  department?: string | null
): string {
  const t = (identityType || "").toLowerCase();
  const d = (department || "").toLowerCase();
  if (t.includes("security") || d.includes("security")) return "SEC-ALL";
  if (t.includes("visitor")) return "VISITOR";
  if (
    d.includes("finance") ||
    d.includes("account") ||
    d.includes("treasury")
  )
    return "FIN-STD";
  if (
    d.includes("executive") ||
    d.includes("management") ||
    t === "employee" && d.includes("director")
  )
    return "EXEC";
  if (
    t.includes("factory") ||
    t.includes("machine") ||
    t.includes("warehouse") ||
    d.includes("production") ||
    d.includes("manufacturing") ||
    d.includes("warehouse")
  )
    return "PROD-STD";
  return "PROD-STD";
}
