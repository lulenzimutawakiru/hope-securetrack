/**
 * AI billing assistants — offline rule-based (pricing, errors, invoice draft).
 */

import type { BillLineInput } from "./types";
import { computeInvoiceTotals } from "./tax";

export type AiInvoiceDraft = {
  invoice_type: string;
  currency: string;
  payment_terms_days: number;
  payment_terms_label: string;
  notes: string;
  lines: BillLineInput[];
  recommendations: string[];
  warnings: string[];
};

export function generateInvoiceFromPrompt(prompt: string): AiInvoiceDraft {
  const p = prompt.toLowerCase();
  const lines: BillLineInput[] = [];
  let invoice_type = "tax";
  let currency = "UGX";
  let terms = 30;
  const recommendations: string[] = [];
  const warnings: string[] = [];

  if (p.includes("proforma") || p.includes("quote")) invoice_type = "proforma";
  if (p.includes("export") || p.includes("international") || p.includes("usd")) {
    invoice_type = "export";
    currency = "USD";
    recommendations.push("Use zero-rated VAT (VAT0) for qualifying exports");
  }
  if (p.includes("credit") || p.includes("return") || p.includes("refund")) {
    invoice_type = "credit_note";
  }
  if (p.includes("subscription") || p.includes("monthly") || p.includes("license")) {
    invoice_type = "recurring";
    terms = 14;
    recommendations.push("Create a recurring schedule for automatic billing");
  }
  if (p.includes("government") || p.includes("lpo")) {
    terms = 45;
    recommendations.push("Capture LPO / PO number for government billing");
  }
  if (p.includes("cash") || p.includes("cod") || p.includes("retail")) {
    terms = 0;
  }

  // Parse simple patterns like "100 cartons at 50000" or "reams 200 @ 12000"
  const qtyPrice =
    prompt.match(
      /(\d+(?:\.\d+)?)\s*(cartons?|reams?|units?|pcs?|hours?|months?)?\s*(?:at|@|x)\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i
    ) ||
    prompt.match(
      /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:ugx|usd|kes)?\s*(?:for|x)\s*(\d+)/i
    );

  if (qtyPrice) {
    const q = parseFloat(String(qtyPrice[1]).replace(/,/g, ""));
    const unit = qtyPrice[2] || "ea";
    const price = parseFloat(String(qtyPrice[3] || qtyPrice[2]).replace(/,/g, ""));
    // if second pattern flipped
    if (!qtyPrice[3] && qtyPrice[2]) {
      lines.push({
        description: extractDescription(prompt) || "Service / product",
        quantity: parseFloat(String(qtyPrice[2])),
        unit: "ea",
        unit_price: q,
        tax_code: invoice_type === "export" ? "VAT0" : "VAT18",
        tax_rate: invoice_type === "export" ? 0 : 18,
      });
    } else {
      lines.push({
        description: extractDescription(prompt) || `${unit} supply`,
        quantity: q,
        unit: String(unit).replace(/s$/, "") || "ea",
        unit_price: price,
        tax_code: invoice_type === "export" ? "VAT0" : "VAT18",
        tax_rate: invoice_type === "export" ? 0 : 18,
      });
    }
  }

  if (p.includes("security print") || p.includes("secure paper")) {
    lines.push({
      description: "Security printing — custom secure paper stock",
      quantity: 1,
      unit: "job",
      unit_price: 2500000,
      tax_code: "VAT18",
      tax_rate: 18,
    });
  }
  if (p.includes("maintenance") || p.includes("support")) {
    lines.push({
      description: "Annual maintenance & support agreement",
      quantity: 12,
      unit: "month",
      unit_price: 150000,
      tax_code: "VAT18",
      tax_rate: 18,
    });
  }
  if (p.includes("software") || p.includes("license")) {
    lines.push({
      description: "Software license subscription",
      quantity: 1,
      unit: "year",
      unit_price: currency === "USD" ? 1200 : 4500000,
      tax_code: invoice_type === "export" ? "VAT0" : "VAT18",
      tax_rate: invoice_type === "export" ? 0 : 18,
    });
  }

  if (!lines.length) {
    lines.push({
      description: extractDescription(prompt) || "Professional services",
      quantity: 1,
      unit: "lot",
      unit_price: 500000,
      tax_code: "VAT18",
      tax_rate: 18,
    });
    warnings.push("Could not parse quantities — review unit price before issuing");
  }

  const totals = computeInvoiceTotals(lines);
  if (totals.total_amount > 10_000_000) {
    recommendations.push("Large invoice — require dual approval before issue");
  }
  if (terms >= 45) {
    recommendations.push("Long payment terms — check customer credit limit");
  }
  recommendations.push("Verify customer TIN/VAT on tax invoices");
  recommendations.push("Attach delivery note or PO reference when available");

  return {
    invoice_type,
    currency,
    payment_terms_days: terms,
    payment_terms_label: terms === 0 ? "Due on receipt" : `Net ${terms}`,
    notes: `AI-generated draft from: "${prompt.slice(0, 120)}"`,
    lines,
    recommendations,
    warnings,
  };
}

function extractDescription(prompt: string): string {
  const cleaned = prompt
    .replace(/create|generate|invoice|for|please|a|an/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 120);
}

export function analyzeInvoiceDraft(input: {
  customer_id?: string | null;
  lines: BillLineInput[];
  payment_terms_days?: number;
  invoice_type?: string;
}): { errors: string[]; suggestions: string[] } {
  const errors: string[] = [];
  const suggestions: string[] = [];

  if (!input.customer_id) errors.push("Customer is required");
  if (!input.lines?.length) errors.push("Add at least one line item");
  input.lines?.forEach((l, i) => {
    if (!l.description?.trim()) errors.push(`Line ${i + 1}: missing description`);
    if (!(Number(l.quantity) > 0)) errors.push(`Line ${i + 1}: quantity must be > 0`);
    if (Number(l.unit_price) < 0) errors.push(`Line ${i + 1}: negative unit price`);
    if (Number(l.unit_price) === 0) suggestions.push(`Line ${i + 1}: zero price — intentional?`);
  });
  if ((input.payment_terms_days ?? 30) > 90) {
    suggestions.push("Payment terms > 90 days increase collection risk");
  }
  if (input.invoice_type === "tax") {
    suggestions.push("Ensure VAT registration details appear on the tax invoice");
  }
  if (input.invoice_type === "proforma") {
    suggestions.push("Proforma should not be posted to GL as revenue");
  }
  const totals = computeInvoiceTotals(input.lines || []);
  if (totals.tax_amount === 0 && input.invoice_type === "tax") {
    suggestions.push("Tax amount is zero on a tax invoice — check tax codes");
  }

  return { errors, suggestions };
}
