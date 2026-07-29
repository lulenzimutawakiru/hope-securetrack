/** QR / barcode / RFID payload builders & tag HTML */

import { hashPayload } from "@/lib/print/security";

export function buildAssetQrPayload(input: {
  assetTag: string;
  name?: string;
  serial?: string;
  companyId?: string;
}): { payload: string; signature: string } {
  const base =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL
      : "https://hope-securetrack.vercel.app";
  const payload = `${base}/dashboard/assets/scan?tag=${encodeURIComponent(input.assetTag)}`;
  const signature = hashPayload(
    `${input.assetTag}|${input.serial || ""}|${input.companyId || ""}`
  );
  return { payload, signature };
}

export function buildEncryptedQrData(input: {
  assetTag: string;
  name: string;
  serial?: string;
  signature: string;
}): string {
  return JSON.stringify({
    t: "asset",
    tag: input.assetTag,
    n: input.name,
    sn: input.serial,
    sig: input.signature,
    v: 1,
  });
}

export function buildTagLabelHtml(input: {
  companyName?: string;
  assetTag: string;
  name: string;
  department?: string;
  serial?: string;
  qrDataUrl?: string;
  barcodeValue?: string;
}): string {
  const company = input.companyName || "Hope Design Group";
  // Simple CSS barcode bars
  const bits = Array.from(input.barcodeValue || input.assetTag).flatMap((c) => {
    const n = c.charCodeAt(0);
    return [(n >> 2) & 1, (n >> 1) & 1, n & 1, 1, 0];
  });
  const barW = 180 / Math.max(bits.length, 1);
  let rects = "";
  bits.forEach((b, i) => {
    if (b)
      rects += `<rect x="${i * barW}" y="0" width="${Math.max(barW * 0.75, 1)}" height="28" fill="#111"/>`;
  });
  const bcSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="28"><rect width="100%" height="100%" fill="#fff"/>${rects}</svg>`
  )}`;

  // Pseudo QR
  const hash = Array.from(input.assetTag).reduce((a, c) => a + c.charCodeAt(0), 0);
  let qrRects = "";
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const on =
        ((x * 7 + y * 13 + hash) % 5) < 2 ||
        (x < 7 && y < 7) ||
        (x > 13 && y < 7) ||
        (x < 7 && y > 13);
      if (on) qrRects += `<rect x="${x * 3}" y="${y * 3}" width="3" height="3" fill="#111"/>`;
    }
  }
  const qrSvg =
    input.qrDataUrl ||
    `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="63" height="63"><rect fill="#fff" width="100%" height="100%"/>${qrRects}</svg>`
    )}`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><style>
  body{margin:12px;font-family:Inter,system-ui,sans-serif}
  .tag{width:200px;height:120px;border:1px solid #ccc;padding:8px;position:relative;background:#fff}
  .co{font-size:9px;font-weight:700;color:#0D7377}
  .tagid{font-size:11px;font-weight:700;font-family:ui-monospace,monospace;margin:2px 0}
  .name{font-size:10px;max-width:110px}
  .dept{font-size:8px;color:#666}
  .qr{position:absolute;right:8px;top:22px}
  .bc{position:absolute;bottom:6px;left:8px}
  .sn{font-size:8px;color:#444;margin-top:2px}
</style></head><body>
<div class="tag">
  <div class="co">${company}</div>
  <div class="tagid">${input.assetTag}</div>
  <div class="name">${input.name}</div>
  <div class="dept">${input.department || ""}</div>
  <div class="sn">S/N: ${input.serial || "—"}</div>
  <img class="qr" src="${qrSvg}" width="56" height="56" alt="QR"/>
  <img class="bc" src="${bcSvg}" width="120" height="22" alt="BC"/>
</div>
</body></html>`;
}
