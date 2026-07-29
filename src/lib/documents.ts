/**
 * Hope Design ERP — document print / download helpers
 * Uses browser print (Save as PDF) + HTML/CSV downloads (no extra deps).
 */

export type DocLine = {
  description: string;
  quantity?: number | string;
  unit?: string;
  unit_price?: number | string;
  amount?: number | string;
};

export type BusinessDocument = {
  title: string;
  docType: string;
  number: string;
  date?: string;
  dueDate?: string;
  status?: string;
  currency?: string;
  companyName?: string;
  companySub?: string;
  billToLabel?: string;
  billToName?: string;
  billToMeta?: string[];
  shipToName?: string;
  meta?: Array<{ label: string; value: string }>;
  lines?: DocLine[];
  subtotal?: number;
  tax?: number;
  total?: number;
  amountPaid?: number;
  balance?: number;
  notes?: string;
  footerNote?: string;
};

const COMPANY_DEFAULT = {
  name: "Hope Design Group Ltd",
  sub: "Security Printing · Paper Manufacturing · Engineering",
  address: "Kampala, Uganda",
  tagline: "Hope SecureTrack ERP",
};

function money(n: number | string | undefined, currency = "UGX"): string {
  const v = Number(n || 0);
  return `${currency} ${new Intl.NumberFormat("en-UG", {
    maximumFractionDigits: 2,
  }).format(v)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build print-ready HTML for a business document */
export function buildDocumentHtml(doc: BusinessDocument): string {
  const company = doc.companyName ?? COMPANY_DEFAULT.name;
  const sub = doc.companySub ?? COMPANY_DEFAULT.sub;
  const currency = doc.currency ?? "UGX";
  const lines = doc.lines ?? [];

  const lineRows =
    lines.length === 0
      ? `<tr><td colspan="5" style="padding:12px;color:#666;">No line items</td></tr>`
      : lines
          .map((l, i) => {
            const qty = Number(l.quantity ?? 0);
            const price = Number(l.unit_price ?? 0);
            const amt =
              l.amount != null ? Number(l.amount) : qty * price;
            return `<tr>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${i + 1}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(l.description || "—")}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${qty}${l.unit ? ` ${escapeHtml(l.unit)}` : ""}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(price, currency)}</td>
              <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(amt, currency)}</td>
            </tr>`;
          })
          .join("");

  const metaHtml = (doc.meta ?? [])
    .map(
      (m) =>
        `<div><span style="color:#64748b;font-size:11px;">${escapeHtml(m.label)}</span><br/><strong>${escapeHtml(m.value)}</strong></div>`
    )
    .join("");

  const billMeta = (doc.billToMeta ?? [])
    .map((m) => `<div style="color:#475569;font-size:12px;">${escapeHtml(m)}</div>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(doc.docType)} ${escapeHtml(doc.number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 0; padding: 32px; background: #fff; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #0f766e; padding-bottom: 16px; margin-bottom: 24px; }
    .brand h1 { margin: 0; font-size: 22px; color: #0f172a; }
    .brand p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
    .doc-badge { text-align: right; }
    .doc-badge .type { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #0f766e; font-weight: 700; }
    .doc-badge .num { font-size: 20px; font-weight: 700; font-family: ui-monospace, monospace; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .box { background: #f8fafc; border-radius: 8px; padding: 14px; }
    .box h3 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    th { text-align: left; padding: 10px 8px; background: #0f172a; color: #fff; font-weight: 600; font-size: 11px; text-transform: uppercase; }
    th.r, td.r { text-align: right; }
    .totals { margin-left: auto; width: 280px; font-size: 13px; }
    .totals .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
    .totals .grand { font-size: 16px; font-weight: 700; border-bottom: none; padding-top: 10px; color: #0f766e; }
    .notes { margin-top: 20px; padding: 12px; background: #fffbeb; border-radius: 8px; font-size: 12px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
    .status { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #ccfbf1; color: #0f766e; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    @media print {
      body { padding: 12mm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <h1>${escapeHtml(company)}</h1>
      <p>${escapeHtml(sub)}</p>
      <p>${escapeHtml(COMPANY_DEFAULT.address)}</p>
    </div>
    <div class="doc-badge">
      <div class="type">${escapeHtml(doc.docType)}</div>
      <div class="num">${escapeHtml(doc.number)}</div>
      ${doc.status ? `<div style="margin-top:8px;"><span class="status">${escapeHtml(doc.status)}</span></div>` : ""}
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <h3>${escapeHtml(doc.billToLabel ?? "Bill to")}</h3>
      <div style="font-weight:600;font-size:15px;">${escapeHtml(doc.billToName ?? "—")}</div>
      ${billMeta}
    </div>
    <div class="box">
      <h3>Document details</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;">
        ${doc.date ? `<div><span style="color:#64748b;font-size:11px;">Date</span><br/><strong>${escapeHtml(doc.date)}</strong></div>` : ""}
        ${doc.dueDate ? `<div><span style="color:#64748b;font-size:11px;">Due date</span><br/><strong>${escapeHtml(doc.dueDate)}</strong></div>` : ""}
        ${metaHtml}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px;">#</th>
        <th>Description</th>
        <th class="r">Qty</th>
        <th class="r">Unit price</th>
        <th class="r">Amount</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <div class="totals">
    ${doc.subtotal != null ? `<div class="row"><span>Subtotal</span><span>${money(doc.subtotal, currency)}</span></div>` : ""}
    ${doc.tax != null ? `<div class="row"><span>Tax / VAT</span><span>${money(doc.tax, currency)}</span></div>` : ""}
    ${doc.total != null ? `<div class="row grand"><span>Total</span><span>${money(doc.total, currency)}</span></div>` : ""}
    ${doc.amountPaid != null ? `<div class="row"><span>Amount paid</span><span>${money(doc.amountPaid, currency)}</span></div>` : ""}
    ${doc.balance != null ? `<div class="row"><span>Balance due</span><span>${money(doc.balance, currency)}</span></div>` : ""}
  </div>

  ${
    doc.notes
      ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(doc.notes)}</div>`
      : ""
  }

  <div class="footer">
    <div>${escapeHtml(doc.footerNote ?? "Computer-generated document · Hope Design ERP")}</div>
    <div>${escapeHtml(COMPANY_DEFAULT.tagline)} · ${new Date().toLocaleString()}</div>
  </div>
  <script>
    // Auto-focus print when opened for printing
    if (location.search.includes('autoprint=1')) {
      window.onload = function() { setTimeout(function(){ window.print(); }, 250); };
    }
  </script>
</body>
</html>`;
}

/**
 * Open the system print dialog for a business document.
 * Uses a hidden iframe (not window.open) so it works after async data loads
 * and is not blocked by popup blockers. Falls back to blob tab + HTML download.
 */
export function printDocument(doc: BusinessDocument): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Print is only available in the browser");
  }

  const html = buildDocumentHtml(doc);

  // Primary: hidden iframe print (reliable after async, no popup)
  try {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("title", "Print document");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
    const frameWin = iframe.contentWindow;
    if (!frameDoc || !frameWin) {
      document.body.removeChild(iframe);
      throw new Error("Print frame unavailable");
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    const cleanup = () => {
      try {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      } catch {
        /* ignore */
      }
    };

    const doPrint = () => {
      try {
        frameWin.focus();
        frameWin.print();
      } catch (e) {
        cleanup();
        // Fallback: open blob URL in new tab
        printViaBlob(html, doc);
        return;
      }
      // Remove frame after print dialog (afterprint or timeout)
      frameWin.addEventListener?.("afterprint", cleanup);
      setTimeout(cleanup, 60_000);
    };

    // Wait for images/fonts if any
    if (frameDoc.readyState === "complete") {
      setTimeout(doPrint, 150);
    } else {
      iframe.onload = () => setTimeout(doPrint, 150);
      setTimeout(doPrint, 400);
    }
    return;
  } catch {
    /* try fallbacks */
  }

  printViaBlob(html, doc);
}

function printViaBlob(html: string, doc: BusinessDocument): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  // Note: do NOT use "noopener" — we need a usable window reference for print
  const w = window.open(url, "_blank", "width=900,height=1000");
  if (!w) {
    // Last resort: download HTML so user can open and print
    downloadDocumentHtml(doc);
    URL.revokeObjectURL(url);
    throw new Error(
      "Pop-up blocked. HTML file downloaded — open it and use Print (Ctrl+P)."
    );
  }
  const trigger = () => {
    try {
      w.focus();
      w.print();
    } catch {
      /* user can print from the open tab */
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  // Blob documents may load async
  setTimeout(trigger, 400);
}

/** Download HTML file (open in browser → Print → Save as PDF) */
export function downloadDocumentHtml(doc: BusinessDocument, filename?: string): void {
  const html = buildDocumentHtml(doc);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ??
    `${doc.docType.replace(/\s+/g, "-").toLowerCase()}-${doc.number}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download CSV of document lines + header */
export function downloadDocumentCsv(doc: BusinessDocument, filename?: string): void {
  const currency = doc.currency ?? "UGX";
  const headers = ["Line", "Description", "Quantity", "Unit", "Unit Price", "Amount", "Currency"];
  const rows = (doc.lines ?? []).map((l, i) => {
    const qty = Number(l.quantity ?? 0);
    const price = Number(l.unit_price ?? 0);
    const amt = l.amount != null ? Number(l.amount) : qty * price;
    return [
      i + 1,
      `"${(l.description || "").replace(/"/g, '""')}"`,
      qty,
      l.unit ?? "",
      price,
      amt,
      currency,
    ].join(",");
  });
  const meta = [
    `# ${doc.docType} ${doc.number}`,
    `# Date: ${doc.date ?? ""}`,
    `# Bill to: ${doc.billToName ?? ""}`,
    `# Total: ${doc.total ?? ""} ${currency}`,
    "",
  ];
  const csv = [...meta, headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ??
    `${doc.docType.replace(/\s+/g, "-").toLowerCase()}-${doc.number}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Generic table export to CSV */
export function downloadCsv(
  filename: string,
  columns: string[],
  rows: Array<Array<string | number | null | undefined>>
): void {
  const header = columns.join(",");
  const body = rows
    .map((r) =>
      r
        .map((c) => {
          if (c == null) return "";
          const s = String(c).replace(/"/g, '""');
          return s.includes(",") || s.includes("\n") ? `"${s}"` : s;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
