/**
 * Tax computation for Hope Design billing (VAT, WHT, zero-rated, exempt).
 */

import type { BillLineInput, ComputedTotals, TaxBreakdownRow } from "./types";

export type TaxCodeDef = {
  tax_code: string;
  name: string;
  tax_type: string;
  rate: number;
};

const DEFAULT_TAXES: TaxCodeDef[] = [
  { tax_code: "VAT18", name: "Uganda VAT 18%", tax_type: "vat", rate: 18 },
  { tax_code: "VAT0", name: "Zero-rated VAT", tax_type: "zero", rate: 0 },
  { tax_code: "EXEMPT", name: "VAT Exempt", tax_type: "exempt", rate: 0 },
  { tax_code: "WHT6", name: "Withholding Tax 6%", tax_type: "withholding", rate: 6 },
];

export function resolveTaxRate(
  line: BillLineInput,
  taxCodes?: TaxCodeDef[]
): { rate: number; code: string; type: string; name: string } {
  const codes = taxCodes?.length ? taxCodes : DEFAULT_TAXES;
  if (line.tax_code) {
    const found = codes.find((c) => c.tax_code === line.tax_code);
    if (found) {
      return {
        rate: Number(found.rate),
        code: found.tax_code,
        type: found.tax_type,
        name: found.name,
      };
    }
  }
  if (line.tax_rate != null) {
    return {
      rate: Number(line.tax_rate),
      code: `RATE-${line.tax_rate}`,
      type: "vat",
      name: `Tax ${line.tax_rate}%`,
    };
  }
  const def = codes.find((c) => c.tax_code === "VAT18") || codes[0];
  return {
    rate: Number(def?.rate ?? 18),
    code: def?.tax_code || "VAT18",
    type: def?.tax_type || "vat",
    name: def?.name || "VAT",
  };
}

export function computeInvoiceTotals(
  lines: BillLineInput[],
  opts?: {
    shipping_amount?: number;
    withholding_rate?: number;
    taxCodes?: TaxCodeDef[];
    amount_paid?: number;
  }
): ComputedTotals {
  const shipping = Number(opts?.shipping_amount || 0);
  const breakdownMap = new Map<string, TaxBreakdownRow>();
  let subtotal = 0;
  let discount_amount = 0;
  let tax_amount = 0;
  let withholding_base = 0;

  const computedLines = lines.map((line) => {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unit_price) || 0;
    const discPct = Number(line.discount_pct) || 0;
    const gross = qty * price;
    const disc = (gross * discPct) / 100;
    const net = gross - disc;
    const taxInfo = resolveTaxRate(line, opts?.taxCodes);
    const isWht = taxInfo.type === "withholding";
    const lineTax = isWht ? 0 : (net * taxInfo.rate) / 100;

    subtotal += gross;
    discount_amount += disc;
    tax_amount += lineTax;
    if (isWht) withholding_base += net;

    if (!isWht && taxInfo.rate >= 0) {
      const key = taxInfo.code;
      const prev = breakdownMap.get(key) || {
        tax_code: taxInfo.code,
        name: taxInfo.name,
        rate: taxInfo.rate,
        taxable: 0,
        tax: 0,
      };
      prev.taxable += net;
      prev.tax += lineTax;
      breakdownMap.set(key, prev);
    }

    return {
      ...line,
      quantity: qty,
      unit_price: price,
      tax_rate: taxInfo.rate,
      tax_code: taxInfo.code,
      line_subtotal: gross,
      discount_amount: disc,
      tax_amount: lineTax,
      line_total: net + lineTax,
    };
  });

  const whtRate = Number(opts?.withholding_rate || 0);
  // Withholding tax applied on net taxable (after discount), if rate provided
  const wht =
    whtRate > 0
      ? ((subtotal - discount_amount + withholding_base * 0) * whtRate) / 100
      : 0;

  const total_amount =
    subtotal - discount_amount + tax_amount + shipping - wht;
  const amount_paid = Number(opts?.amount_paid || 0);

  return {
    subtotal: round2(subtotal),
    discount_amount: round2(discount_amount),
    tax_amount: round2(tax_amount),
    withholding_tax: round2(wht),
    shipping_amount: round2(shipping),
    total_amount: round2(total_amount),
    balance_due: round2(Math.max(0, total_amount - amount_paid)),
    tax_breakdown: Array.from(breakdownMap.values()).map((r) => ({
      ...r,
      taxable: round2(r.taxable),
      tax: round2(r.tax),
    })),
    lines: computedLines.map((l) => ({
      ...l,
      line_subtotal: round2(l.line_subtotal),
      discount_amount: round2(l.discount_amount),
      tax_amount: round2(l.tax_amount),
      line_total: round2(l.line_total),
    })),
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function dueDateFromTerms(
  invoiceDate: string | Date,
  termsDays: number
): string {
  const d = new Date(invoiceDate);
  d.setDate(d.getDate() + (termsDays || 0));
  return d.toISOString().slice(0, 10);
}
