/**
 * Invoice / receipt numbering: HDG-INV-2026-000001
 */

export type BillSequenceConfig = {
  prefix: string;
  branch_code?: string | null;
  include_year?: boolean;
  include_month?: boolean;
  pad_length?: number;
  next_value: number | string;
  check_digit?: boolean;
  separator?: string;
};

export function formatBillNumber(cfg: BillSequenceConfig): string {
  const sep = cfg.separator ?? "-";
  const pad = cfg.pad_length ?? 6;
  const seq = String(Number(cfg.next_value)).padStart(pad, "0");
  const parts: string[] = [];
  if (cfg.prefix) parts.push(cfg.prefix);
  if (cfg.branch_code) parts.push(cfg.branch_code);
  if (cfg.include_year !== false) parts.push(String(new Date().getFullYear()));
  if (cfg.include_month) {
    parts.push(String(new Date().getMonth() + 1).padStart(2, "0"));
  }
  parts.push(seq);
  let number = parts.join(sep);
  if (cfg.check_digit) {
    const digits = seq.replace(/\D/g, "");
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
    number = `${number}${sep}${(10 - (sum % 10)) % 10}`;
  }
  return number;
}

export function sequenceCodeForType(invoiceType: string): string {
  switch (invoiceType) {
    case "proforma":
      return "PRO";
    case "credit_note":
      return "CRN";
    case "debit_note":
      return "DBN";
    case "commercial":
      return "COM";
    case "export":
      return "INV";
    case "recurring":
      return "INV";
    default:
      return "INV";
  }
}

export function createInvoiceQrId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `INV-${Date.now().toString(36).toUpperCase()}`;
}
