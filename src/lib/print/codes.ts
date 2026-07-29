/** QR & barcode payload builders */

export type QrPurpose =
  | "product_auth"
  | "employee_id"
  | "portal"
  | "asset"
  | "inventory"
  | "attendance"
  | "url"
  | "wifi"
  | "vcard";

export function buildQrPayload(
  purpose: QrPurpose,
  data: Record<string, string>
): string {
  switch (purpose) {
    case "product_auth":
      return data.verify_url || data.serial || "";
    case "url":
      return data.url || "";
    case "wifi":
      return `WIFI:T:${data.encryption || "WPA"};S:${data.ssid || ""};P:${data.password || ""};;`;
    case "vcard":
      return [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${data.name || ""}`,
        data.org ? `ORG:${data.org}` : "",
        data.phone ? `TEL:${data.phone}` : "",
        data.email ? `EMAIL:${data.email}` : "",
        "END:VCARD",
      ]
        .filter(Boolean)
        .join("\n");
    case "employee_id":
      return JSON.stringify({
        t: "wid",
        id: data.employee_number || data.id,
        n: data.name,
      });
    case "asset":
      return JSON.stringify({ t: "asset", code: data.code, sn: data.serial });
    case "inventory":
      return JSON.stringify({ t: "inv", sku: data.sku, loc: data.location });
    case "attendance":
      return JSON.stringify({ t: "att", emp: data.employee_number, ts: data.ts });
    case "portal":
      return data.portal_url || data.token || "";
    default:
      return data.payload || JSON.stringify(data);
  }
}

export function validateEan13(code: string): boolean {
  const digits = code.replace(/\D/g, "");
  if (digits.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[12]);
}

/** Simple Code 128 display value sanitizer */
export function sanitizeCode128(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, "").slice(0, 48);
}

export function generateSerial(prefix: string, seq: number, width = 6): string {
  return `${prefix}-${String(seq).padStart(width, "0")}`;
}

/** CSS/SVG-friendly QR placeholder (for preview; real encode via external or canvas) */
export function qrPreviewDataUrl(payload: string, size = 120): string {
  // Deterministic pseudo-QR pattern for UI preview (not scannable)
  const hash = Array.from(payload).reduce((a, c) => a + c.charCodeAt(0), 0);
  const cells = 21;
  const cell = size / cells;
  let rects = "";
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const on = ((x * 7 + y * 13 + hash) % 5) < 2 || (x < 7 && y < 7) || (x > cells - 8 && y < 7) || (x < 7 && y > cells - 8);
      if (on) {
        rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="#111"/>`;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#fff"/>${rects}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function barcodePreviewBars(value: string, width = 200, height = 40): string {
  const bits = Array.from(value || "0").flatMap((c) => {
    const n = c.charCodeAt(0);
    return [(n >> 2) & 1, (n >> 1) & 1, n & 1, 1, 0];
  });
  const barW = width / Math.max(bits.length, 1);
  let rects = "";
  bits.forEach((b, i) => {
    if (b) rects += `<rect x="${i * barW}" y="0" width="${Math.max(barW * 0.8, 1)}" height="${height}" fill="#111"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/>${rects}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
