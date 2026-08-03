/**
 * Professional invoice HTML for print / PDF (browser) and designer preview.
 */

import type { TaxBreakdownRow } from "./types";

export type InvoicePrintModel = {
  title?: string;
  invoice_number: string;
  invoice_type?: string;
  status?: string;
  invoice_date?: string;
  due_date?: string | null;
  currency?: string;
  company_name?: string;
  company_sub?: string;
  company_address?: string;
  company_tax?: string;
  customer_name?: string;
  customer_address?: string;
  customer_tax_id?: string;
  customer_vat?: string;
  po_number?: string | null;
  reference?: string | null;
  payment_terms_label?: string | null;
  lines: Array<{
    description: string;
    quantity: number | string;
    unit?: string | null;
    unit_price: number | string;
    tax_rate?: number | string;
    discount_pct?: number | string;
    line_total?: number | string;
  }>;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  withholding_tax?: number;
  shipping_amount?: number;
  total_amount?: number;
  amount_paid?: number;
  balance_due?: number;
  tax_breakdown?: TaxBreakdownRow[];
  notes?: string | null;
  bank_details?: string | null;
  terms_conditions?: string | null;
  qr_public_id?: string | null;
  primary_color?: string;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number | string | undefined, currency = "UGX"): string {
  const v = Number(n || 0);
  return `${currency} ${new Intl.NumberFormat("en-UG", {
    maximumFractionDigits: 2,
  }).format(v)}`;
}

export function buildInvoiceHtml(doc: InvoicePrintModel): string {
  const currency = doc.currency || "UGX";
  const color = doc.primary_color || "#0f766e";
  const title =
    doc.title ||
    (doc.invoice_type === "proforma"
      ? "PROFORMA INVOICE"
      : doc.invoice_type === "credit_note"
        ? "CREDIT NOTE"
        : doc.invoice_type === "debit_note"
          ? "DEBIT NOTE"
          : doc.invoice_type === "commercial"
            ? "COMMERCIAL INVOICE"
            : "TAX INVOICE");

  const lineRows =
    (doc.lines || []).length === 0
      ? `<tr><td colspan="6" style="padding:12px;color:#666;">No line items</td></tr>`
      : doc.lines
          .map((l, i) => {
            const qty = Number(l.quantity || 0);
            const price = Number(l.unit_price || 0);
            const total =
              l.line_total != null
                ? Number(l.line_total)
                : qty * price * (1 - Number(l.discount_pct || 0) / 100);
            return `<tr>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${i + 1}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${esc(String(l.description || "—"))}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${qty}${l.unit ? ` ${esc(String(l.unit))}` : ""}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(price, currency)}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${l.tax_rate ?? 0}%</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(total, currency)}</td>
            </tr>`;
          })
          .join("");

  const taxRows = (doc.tax_breakdown || [])
    .map(
      (t) =>
        `<div class="row"><span>${esc(t.name)} (${t.rate}%)</span><span>${money(t.tax, currency)}</span></div>`
    )
    .join("");

  const qrContent = encodeURIComponent(
    doc.qr_public_id
      ? `SecureTrack ERP Invoice ${doc.invoice_number} · ${doc.qr_public_id}`
      : doc.invoice_number
  );
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrContent}`;

  const bank = (doc.bank_details || "")
    .split("\n")
    .map((l) => `<div>${esc(l)}</div>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${esc(title)} ${esc(doc.invoice_number)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:0;padding:28px;background:#fff}
  .header{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid ${color};padding-bottom:14px;margin-bottom:20px}
  .brand h1{margin:0;font-size:20px}
  .brand p{margin:3px 0 0;color:#64748b;font-size:12px}
  .badge{text-align:right}
  .badge .type{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${color};font-weight:700}
  .badge .num{font-size:18px;font-weight:700;font-family:ui-monospace,monospace}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px}
  .box{background:#f8fafc;border-radius:8px;padding:12px}
  .box h3{margin:0 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px}
  th{text-align:left;padding:8px;background:#0f172a;color:#fff;font-size:10px;text-transform:uppercase}
  th.r,td.r{text-align:right}
  .totals{margin-left:auto;width:280px;font-size:12px}
  .totals .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #e2e8f0}
  .totals .grand{font-size:15px;font-weight:700;border-bottom:none;padding-top:8px;color:${color}}
  .footer-grid{display:grid;grid-template-columns:1fr 1fr 100px;gap:16px;margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:11px;color:#475569}
  .notes{margin-top:14px;padding:10px;background:#fffbeb;border-radius:8px;font-size:11px}
  .status{display:inline-block;padding:2px 8px;border-radius:999px;background:#ccfbf1;color:${color};font-size:10px;font-weight:600;text-transform:uppercase}
  @media print{body{padding:10mm}.no-print{display:none!important}}
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <h1>${esc(doc.company_name || "SecureTrack ERP")}</h1>
      <p>${esc(doc.company_sub || "Security Printing · Paper Manufacturing · Engineering")}</p>
      <p>${esc(doc.company_address || "Kampala, Uganda")}</p>
      ${doc.company_tax ? `<p>TIN / Tax: ${esc(doc.company_tax)}</p>` : ""}
    </div>
    <div class="badge">
      <div class="type">${esc(title)}</div>
      <div class="num">${esc(doc.invoice_number)}</div>
      ${doc.status ? `<div style="margin-top:6px"><span class="status">${esc(doc.status)}</span></div>` : ""}
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <h3>Bill to</h3>
      <div style="font-weight:600;font-size:14px">${esc(doc.customer_name || "—")}</div>
      ${doc.customer_address ? `<div style="font-size:12px;color:#475569;margin-top:4px;white-space:pre-line">${esc(doc.customer_address)}</div>` : ""}
      ${doc.customer_tax_id ? `<div style="font-size:11px;margin-top:4px">Tax ID: ${esc(doc.customer_tax_id)}</div>` : ""}
      ${doc.customer_vat ? `<div style="font-size:11px">VAT: ${esc(doc.customer_vat)}</div>` : ""}
    </div>
    <div class="box">
      <h3>Invoice details</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        <div><span style="color:#64748b;font-size:10px">Date</span><br/><strong>${esc(doc.invoice_date || "")}</strong></div>
        <div><span style="color:#64748b;font-size:10px">Due date</span><br/><strong>${esc(doc.due_date || "—")}</strong></div>
        <div><span style="color:#64748b;font-size:10px">Terms</span><br/><strong>${esc(doc.payment_terms_label || "—")}</strong></div>
        <div><span style="color:#64748b;font-size:10px">Currency</span><br/><strong>${esc(currency)}</strong></div>
        ${doc.po_number ? `<div><span style="color:#64748b;font-size:10px">PO</span><br/><strong>${esc(doc.po_number)}</strong></div>` : ""}
        ${doc.reference ? `<div><span style="color:#64748b;font-size:10px">Reference</span><br/><strong>${esc(doc.reference)}</strong></div>` : ""}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th>Description</th>
        <th class="r">Qty</th>
        <th class="r">Unit price</th>
        <th class="r">Tax</th>
        <th class="r">Amount</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${money(doc.subtotal, currency)}</span></div>
    ${doc.discount_amount ? `<div class="row"><span>Discount</span><span>-${money(doc.discount_amount, currency)}</span></div>` : ""}
    ${taxRows || (doc.tax_amount != null ? `<div class="row"><span>Tax / VAT</span><span>${money(doc.tax_amount, currency)}</span></div>` : "")}
    ${doc.shipping_amount ? `<div class="row"><span>Shipping</span><span>${money(doc.shipping_amount, currency)}</span></div>` : ""}
    ${doc.withholding_tax ? `<div class="row"><span>Withholding tax</span><span>-${money(doc.withholding_tax, currency)}</span></div>` : ""}
    <div class="row grand"><span>Total</span><span>${money(doc.total_amount, currency)}</span></div>
    ${doc.amount_paid ? `<div class="row"><span>Amount paid</span><span>${money(doc.amount_paid, currency)}</span></div>` : ""}
    ${doc.balance_due != null ? `<div class="row"><span>Balance due</span><span>${money(doc.balance_due, currency)}</span></div>` : ""}
  </div>

  ${doc.notes ? `<div class="notes"><strong>Notes:</strong> ${esc(doc.notes)}</div>` : ""}

  <div class="footer-grid">
    <div>
      <strong style="color:#0f172a">Bank / payment details</strong>
      <div style="margin-top:6px;white-space:pre-line">${bank || "—"}</div>
    </div>
    <div>
      <strong style="color:#0f172a">Terms &amp; conditions</strong>
      <div style="margin-top:6px">${esc(doc.terms_conditions || "Payment due as stated. Goods remain property of seller until paid in full.")}</div>
      <div style="margin-top:16px;border-top:1px solid #94a3b8;padding-top:4px;font-style:italic">Authorised signature</div>
    </div>
    <div style="text-align:center">
      <img src="${qrUrl}" alt="QR" width="90" height="90"/>
      <div style="font-size:9px;margin-top:4px">${esc(doc.qr_public_id || doc.invoice_number)}</div>
    </div>
  </div>
  <p style="margin-top:20px;font-size:10px;color:#94a3b8">Computer-generated document · SecureTrack ERP · ${esc(new Date().toLocaleString())}</p>
  <script>
    if (location.search.includes('autoprint=1')) {
      window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };
    }
  </script>
</body>
</html>`;
}

export function printInvoiceHtml(html: string): void {
  if (typeof document === "undefined") return;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    throw new Error("Print frame unavailable");
  }
  doc.open();
  doc.write(html);
  doc.close();
  const cleanup = () => {
    try {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    } catch {
      /* ignore */
    }
  };
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      cleanup();
      return;
    }
    win.addEventListener?.("afterprint", cleanup);
    setTimeout(cleanup, 60_000);
  }, 300);
}
