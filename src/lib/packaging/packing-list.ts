/** Packing list HTML generator */

export function buildPackingListHtml(input: {
  listNumber: string;
  companyName?: string;
  customerName?: string;
  orderRef?: string;
  productName?: string;
  cartons: Array<{ serial: string; units?: number; weight_kg?: number }>;
  pallets?: Array<{ serial: string; cartons: number }>;
  grossWeightKg?: number;
  netWeightKg?: number;
}): string {
  const company = input.companyName || "SecureTrack ERP";
  const cartonRows = input.cartons
    .map(
      (c, i) =>
        `<tr><td>${i + 1}</td><td class="mono">${c.serial}</td><td>${c.units ?? 5}</td><td>${c.weight_kg ?? "—"}</td></tr>`
    )
    .join("");
  const palletRows = (input.pallets || [])
    .map(
      (p, i) =>
        `<tr><td>${i + 1}</td><td class="mono">${p.serial}</td><td>${p.cartons}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Packing List ${input.listNumber}</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;margin:28px;color:#1a1a1a;font-size:13px}
  h1{color:#0D7377;font-size:20px;margin:0}
  .meta{color:#555;font-size:11px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th,td{border:1px solid #e5e5e5;padding:6px 8px;text-align:left}
  th{background:#0D737715}
  .mono{font-family:ui-monospace,monospace;font-size:11px}
  .totals{margin-top:16px;font-weight:600}
  .sig{margin-top:40px;display:flex;justify-content:space-between}
  .sig div{border-top:1px solid #999;width:40%;padding-top:4px;font-size:11px;color:#555}
</style></head><body>
  <h1>${company}</h1>
  <div class="meta">PACKING LIST · ${input.listNumber}<br/>
  Customer: ${input.customerName || "—"} · Order: ${input.orderRef || "—"}</div>
  <p><strong>Product:</strong> ${input.productName || "—"}</p>
  <h3>Cartons (${input.cartons.length})</h3>
  <table>
    <tr><th>#</th><th>Carton Serial / QR</th><th>Units</th><th>Weight kg</th></tr>
    ${cartonRows || "<tr><td colspan='4'>No cartons</td></tr>"}
  </table>
  ${
    input.pallets?.length
      ? `<h3>Pallets (${input.pallets.length})</h3>
  <table>
    <tr><th>#</th><th>Pallet Serial / QR</th><th>Cartons</th></tr>
    ${palletRows}
  </table>`
      : ""
  }
  <div class="totals">
    Net weight: ${input.netWeightKg ?? "—"} kg · Gross weight: ${input.grossWeightKg ?? "—"} kg
  </div>
  <div class="sig">
    <div>Packed by / date</div>
    <div>Received by / date</div>
  </div>
</body></html>`;
}
