/** Security printing helpers */

export interface SecurityOptions {
  watermark?: string;
  microtext?: string;
  invisibleMarker?: string;
  uvPlaceholder?: boolean;
  hologramZone?: boolean;
  tamperQr?: boolean;
  digitalSignature?: boolean;
  serialPrefix?: string;
  backgroundPattern?: string;
}

export function buildSecurityOverlay(opts: SecurityOptions): {
  css: string;
  html: string;
  serialHint: string;
} {
  const wm = opts.watermark || "AUTHENTIC";
  const micro = opts.microtext || "SECURE-TRACK";
  const serialHint = `${opts.serialPrefix || "SEC"}-{{seq}}`;

  const css = `
    .sec-wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
      font-size:48px;opacity:0.06;transform:rotate(-28deg);pointer-events:none;font-weight:800;letter-spacing:4px}
    .sec-micro{position:absolute;bottom:4px;left:4px;right:4px;font-size:4px;letter-spacing:0.5px;
      color:#333;opacity:0.45;overflow:hidden;white-space:nowrap}
    .sec-holo{position:absolute;top:8px;right:8px;width:36px;height:36px;border:1px dashed #0D7377;
      border-radius:50%;font-size:7px;display:flex;align-items:center;justify-content:center;color:#0D7377}
    .sec-uv{position:absolute;top:8px;left:8px;font-size:8px;color:transparent;text-shadow:0 0 0 #9cf}
    .sec-sig{position:absolute;bottom:16px;right:8px;font-size:8px;font-family:monospace;color:#555}
  `;

  const html = [
    `<div class="sec-wm">${wm}</div>`,
    `<div class="sec-micro">${Array(20).fill(micro).join(" · ")}</div>`,
    opts.hologramZone ? `<div class="sec-holo">HOLO</div>` : "",
    opts.uvPlaceholder ? `<div class="sec-uv">UV</div>` : "",
    opts.digitalSignature ? `<div class="sec-sig">SIG:{{hash}}</div>` : "",
  ]
    .filter(Boolean)
    .join("");

  return { css, html, serialHint };
}

export function hashPayload(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

export function securityChecklist(opts: SecurityOptions): Array<{ item: string; ok: boolean }> {
  return [
    { item: "Watermark", ok: Boolean(opts.watermark) },
    { item: "Microtext", ok: Boolean(opts.microtext) },
    { item: "Tamper-evident QR", ok: Boolean(opts.tamperQr) },
    { item: "Digital signature placeholder", ok: Boolean(opts.digitalSignature) },
    { item: "Hologram zone", ok: Boolean(opts.hologramZone) },
    { item: "UV placeholder", ok: Boolean(opts.uvPlaceholder) },
    { item: "Serialized numbering", ok: Boolean(opts.serialPrefix) },
  ];
}
