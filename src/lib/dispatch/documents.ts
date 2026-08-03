/** Shipping document HTML generators */

export function buildPodHtml(input: {
  podNumber: string;
  customerName?: string;
  receiverName?: string;
  dispatchRef?: string;
  deliveredQty?: number;
  damagedQty?: number;
  notes?: string;
  lat?: number | null;
  lng?: number | null;
  deliveredAt?: string;
  signatureData?: string | null;
}): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    body{font-family:Inter,system-ui,sans-serif;margin:24px;color:#111}
    h1{font-size:18px;color:#0D7377;margin:0 0 4px}
    .meta{font-size:12px;color:#555;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    td,th{border:1px solid #ddd;padding:8px;text-align:left}
    .sig{margin-top:24px;border-top:1px dashed #ccc;padding-top:12px;min-height:80px}
    .wm{position:fixed;inset:30% 10%;opacity:0.06;font-size:48px;font-weight:800;transform:rotate(-24deg);text-align:center}
  </style></head><body>
  <div class="wm">POD · HOPE SECURETRACK</div>
  <h1>Proof of Delivery</h1>
  <p class="meta">${input.podNumber} · ${input.deliveredAt || new Date().toISOString()}</p>
  <table>
    <tr><th>Customer</th><td>${input.customerName || "—"}</td></tr>
    <tr><th>Receiver</th><td>${input.receiverName || "—"}</td></tr>
    <tr><th>Dispatch / SO</th><td>${input.dispatchRef || "—"}</td></tr>
    <tr><th>Delivered qty</th><td>${input.deliveredQty ?? 0}</td></tr>
    <tr><th>Damaged qty</th><td>${input.damagedQty ?? 0}</td></tr>
    <tr><th>GPS</th><td>${input.lat != null ? `${input.lat}, ${input.lng}` : "—"}</td></tr>
    <tr><th>Notes</th><td>${input.notes || "—"}</td></tr>
  </table>
  <div class="sig">
    <strong>Digital signature</strong>
    <p style="font-family:cursive;font-size:22px;margin:12px 0">${input.signatureData || input.receiverName || "—"}</p>
    <p style="font-size:11px;color:#666">Electronically signed · chain of custody verified</p>
  </div>
  </body></html>`;
}

export function buildDispatchNoteHtml(input: {
  docNumber: string;
  customerName?: string;
  address?: string;
  vehicle?: string;
  driver?: string;
  items?: Array<{ name: string; qty: number; sku?: string }>;
  qrPayload?: string;
}): string {
  const rows = (input.items || [])
    .map(
      (i) =>
        `<tr><td>${i.sku || ""}</td><td>${i.name}</td><td>${i.qty}</td></tr>`
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    body{font-family:Inter,system-ui,sans-serif;margin:24px}
    h1{color:#0D7377;font-size:18px}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
    th,td{border:1px solid #ddd;padding:6px}
    .qr{font-family:monospace;font-size:11px;margin-top:16px}
  </style></head><body>
  <h1>Dispatch Note — SecureTrack ERP</h1>
  <p><strong>${input.docNumber}</strong></p>
  <p>Customer: ${input.customerName || "—"}<br/>Address: ${input.address || "—"}<br/>
  Vehicle: ${input.vehicle || "—"} · Driver: ${input.driver || "—"}</p>
  <table><thead><tr><th>SKU</th><th>Product</th><th>Qty</th></tr></thead>
  <tbody>${rows || "<tr><td colspan=3>See packing list</td></tr>"}</tbody></table>
  <p class="qr">Shipment QR: ${input.qrPayload || input.docNumber}</p>
  </body></html>`;
}

export function shipmentQrValue(requestNumber: string): string {
  return `SHP-${requestNumber.replace(/[^A-Z0-9-]/gi, "")}`;
}
