/**
 * Render CR80 ID card HTML from design JSON + field context.
 * Used for designer preview, print, and PDF-via-browser.
 */

import type { CardDesign, CardElement, FieldContext, WidCardBrand } from "./types";
import { buildQrContent } from "./qr-token";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function initialsFromName(name: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0) || "";
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

/** Apply tenant-selected brand styling to a card design (non-destructive). */
const SEED_PALETTE = {
  primary: "#0f766e",
  secondary: "#0f172a",
  accent: "#f59e0b",
};

/** Apply tenant-selected brand styling to a card design (non-destructive). */

export function applyBrandToDesign(
  design: CardDesign,
  brand?: WidCardBrand | null
): CardDesign {
  const cloned: CardDesign = {
    front: (design.front || []).map((el) => ({ ...el })),
    back: (design.back || []).map((el) => ({ ...el })),
  };
  if (!brand) return cloned;

  const primary = brand.primary_color || SEED_PALETTE.primary;
  const secondary = brand.secondary_color || SEED_PALETTE.secondary;
  const accent = brand.accent_color || SEED_PALETTE.accent;
  const text = brand.text_color || brand.secondary_color || SEED_PALETTE.secondary;
  const bg = brand.background_color || "#ffffff";

  // Substitute the template seed palette with the tenant-selected brand palette
  // so the card adopts the tenant style wherever the design uses seed colors.
  const remap = (color?: string | null): string | undefined => {
    if (!color) return undefined;
    const c = color.toLowerCase();
    if (c === SEED_PALETTE.primary) return primary;
    if (c === SEED_PALETTE.secondary) return secondary;
    if (c === SEED_PALETTE.accent) return accent;
    return color;
  };

  const patch = (el: CardElement): CardElement => {
    switch (el.type) {
      case "rect":
      case "ellipse":
        el.fill = remap(el.fill);
        if (!el.fill) el.fill = primary;
        break;
      case "line":
        el.color = remap(el.color || el.fill || undefined);
        if (!el.color) el.color = accent;
        break;
      case "text":
      case "field":
        el.color = remap(el.color);
        if (!el.color) el.color = text;
        break;
      case "logo":
      case "image":
        if (!el.src && brand.logo_url) el.src = brand.logo_url;
        break;
      case "signature":
        if (!el.text && brand.signature_name) el.text = brand.signature_name;
        break;
      default:
        break;
    }
    return el;
  };

  cloned.front = cloned.front.map(patch);
  cloned.back = cloned.back.map(patch);

  // Watermark from brand when the template does not define one
  const hasWatermark = (els: CardElement[]) =>
    els.some((el) => el.type === "watermark");
  if (
    brand.watermark_text &&
    !hasWatermark(cloned.front) &&
    !hasWatermark(cloned.back)
  ) {
    cloned.front.push({
      id: "brand-watermark",
      type: "watermark",
      x: 0,
      y: 30,
      w: 100,
      h: 40,
      z: 50,
      text: brand.watermark_text,
      color: secondary,
      fontSize: 18,
      opacity: 0.18,
    });
  }

  // Signature line on the back when the brand defines one and template lacks it
  const hasSignature = (els: CardElement[]) =>
    els.some((el) => el.type === "signature");
  if (
    brand.signature_name &&
    !hasSignature(cloned.front) &&
    !hasSignature(cloned.back)
  ) {
    cloned.back.push({
      id: "brand-signature",
      type: "signature",
      x: 4,
      y: 78,
      w: 92,
      h: 12,
      z: 30,
      text: brand.signature_name,
    });
  }

  // Background frame in brand colours when the front has no full-bleed rect
  const hasBg = (els: CardElement[]) =>
    els.some(
      (el) => el.type === "rect" && el.x <= 0 && el.y <= 0 && el.w >= 100 && el.h >= 100
    );
  if (!hasBg(cloned.front) && bg !== "#ffffff") {
    cloned.front.unshift({
      id: "brand-bg",
      type: "rect",
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      fill: bg,
      z: -10,
    });
  }

  return cloned;
}


function resolveField(
  el: CardElement,
  ctx: FieldContext
): string {
  if (el.type === "text" || el.type === "microtext" || el.type === "watermark") {
    return el.text || "";
  }
  if (el.type === "field" || el.type === "barcode") {
    const key = el.field || "";
    const val = ctx[key] ?? "";
    if (el.label && val) return `${el.label}: ${val}`;
    if (el.label && !val) return `${el.label}: —`;
    return val || "—";
  }
  return el.text || "";
}

function renderElement(
  el: CardElement,
  ctx: FieldContext,
  qrPublicId?: string | null
): string {
  const style = [
    `position:absolute`,
    `left:${el.x}%`,
    `top:${el.y}%`,
    `width:${el.w}%`,
    `height:${el.h}%`,
    `z-index:${el.z ?? 1}`,
    `opacity:${el.opacity ?? 1}`,
    el.rotation ? `transform:rotate(${el.rotation}deg)` : "",
    `box-sizing:border-box`,
    `overflow:hidden`,
  ]
    .filter(Boolean)
    .join(";");

  switch (el.type) {
    case "rect":
      return `<div style="${style};background:${el.fill || "#e2e8f0"};"></div>`;
    case "ellipse":
      return `<div style="${style};background:${el.fill || "#e2e8f0"};border-radius:50%;"></div>`;
    case "line":
      return `<div style="${style};background:${el.fill || el.color || "#0f172a"};height:2px;top:calc(${el.y}% + ${el.h / 2}%);"></div>`;
    case "photo": {
      const src = ctx.photo_url;
      if (src) {
        return `<div style="${style};border:1px solid #cbd5e1;background:#f1f5f9;"><img src="${esc(src)}" alt="Photo" style="width:100%;height:100%;object-fit:cover;"/></div>`;
      }
      const initials = initialsFromName(ctx.full_name || "");
      return `<div style="${style};border:1px dashed #94a3b8;background:linear-gradient(135deg,#0f766e,#0f172a);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;">${esc(initials)}</div>`;
    }
    case "logo":
    case "image":
      if (el.src) {
        return `<div style="${style}"><img src="${esc(el.src)}" alt="" style="width:100%;height:100%;object-fit:contain;"/></div>`;
      }
      return `<div style="${style};display:flex;align-items:center;font-size:9px;font-weight:700;color:${el.color || "#0f766e"};">${esc(el.text || "LOGO")}</div>`;
    case "qr": {
      const content = encodeURIComponent(
        buildQrContent(qrPublicId || ctx.identity_number || "WID")
      );
      // Use free QR image API for print preview (no dependency)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${content}`;
      return `<div style="${style};background:#fff;padding:2px;"><img src="${qrUrl}" alt="QR" style="width:100%;height:100%;object-fit:contain;"/></div>`;
    }
    case "barcode": {
      const val = resolveField(el, ctx);
      return `<div style="${style};display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div style="width:100%;height:60%;background:repeating-linear-gradient(90deg,#0f172a 0,#0f172a 1px,transparent 1px,transparent 3px);"></div>
        <div style="font-size:7px;font-family:monospace;margin-top:2px;">${esc(val)}</div>
      </div>`;
    }
    case "hologram":
      return `<div style="${style};background:linear-gradient(135deg,#f0abfc,#67e8f9,#fde68a,#f0abfc);opacity:0.55;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;">HOLOGRAM</div>`;
    case "signature":
      return `<div style="${style};border-top:1px solid #94a3b8;font-size:8px;color:#64748b;padding-top:2px;font-style:italic;">${esc(el.text || ctx.manager_name || "Authorised Signature")}</div>`;
    case "watermark":
      return `<div style="${style};display:flex;align-items:center;justify-content:center;font-size:${el.fontSize || 18}px;color:${el.color || "#cbd5e1"};opacity:0.25;font-weight:800;transform:rotate(-25deg);pointer-events:none;">${esc(el.text || "SECURE")}</div>`;
    case "microtext":
      return `<div style="${style};font-size:5px;letter-spacing:0.5px;color:${el.color || "#64748b"};line-height:1.1;word-break:break-all;">${esc((el.text || "SECURETRACK GROUP OFFICIAL CREDENTIAL ").repeat(8))}</div>`;
    case "text":
    case "field":
    default: {
      const content = resolveField(el, ctx);
      const fs = el.fontSize ?? 10;
      const fw = el.bold ? 700 : 500;
      const ff = el.fontFamily || "var(--wid-font, system-ui, sans-serif)";
      const ta = el.align || "left";
      const col = el.color || "#0f172a";
      return `<div style="${style};font-size:${fs}px;font-weight:${fw};font-family:${ff};color:${col};text-align:${ta};display:flex;align-items:center;line-height:1.15;${el.italic ? "font-style:italic;" : ""}">${esc(content)}</div>`;
    }
  }
}

function renderSide(
  elements: CardElement[],
  ctx: FieldContext,
  qrPublicId?: string | null,
  bg = "#ffffff"
): string {
  const sorted = [...(elements || [])].sort(
    (a, b) => (a.z ?? 0) - (b.z ?? 0)
  );
  return `<div class="card-side" style="position:relative;width:100%;height:100%;background:${bg};overflow:hidden;border-radius:6px;">
    ${sorted.map((el) => renderElement(el, ctx, qrPublicId)).join("\n")}
  </div>`;
}

export type CardRenderOptions = {
  design: CardDesign;
  ctx: FieldContext;
  qrPublicId?: string | null;
  widthMm?: number;
  heightMm?: number;
  showBack?: boolean;
  title?: string;
  companyName?: string;
  brand?: WidCardBrand | null;
};

/** Full HTML document for print / iframe */
export function buildCardPrintHtml(opts: CardRenderOptions): string {
  const w = opts.widthMm ?? 85.6;
  const h = opts.heightMm ?? 53.98;
  // Scale for screen: ~3.8 px per mm → ~325 x 205
  const pxW = Math.round(w * 3.78);
  const pxH = Math.round(h * 3.78);
  const fontFamily = opts.brand?.font_family || "system-ui, sans-serif";

  const design = applyBrandToDesign(opts.design, opts.brand);
  const companyName =
    opts.companyName ||
    opts.brand?.company_display_name ||
    "SecureTrack ERP";
  const front = renderSide(design.front || [], opts.ctx, opts.qrPublicId);
  const back =
    opts.showBack !== false
      ? renderSide(design.back || [], opts.ctx, opts.qrPublicId, "#f8fafc")
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${esc(opts.title || "ID Card")} — SecureTrack ERP</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; font-family: ${fontFamily}; background: #e2e8f0; color: #0f172a; }
    h1 { font-size: 14px; margin: 0 0 12px; }
    .wrap { display: flex; flex-wrap: wrap; gap: 20px; }
    .panel { }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 6px; }
    .card-frame {
      --wid-font: ${fontFamily};
      width: ${pxW}px; height: ${pxH}px;
      box-shadow: 0 8px 24px rgba(15,23,42,0.18);
      border: 1px solid #cbd5e1;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .no-print { display: none !important; }
      .card-frame { box-shadow: none; page-break-inside: avoid; margin-bottom: 8mm; }
      @page { size: auto; margin: 8mm; }
    }
  </style>
</head>
<body>
  <h1 class="no-print">${esc(companyName)} — ID Card Print</h1>
  <div class="wrap">
    <div class="panel">
      <div class="label no-print">Front</div>
      <div class="card-frame">${front}</div>
    </div>
    ${
      back
        ? `<div class="panel">
      <div class="label no-print">Back</div>
      <div class="card-frame">${back}</div>
    </div>`
        : ""
    }
  </div>
  <script>
    if (location.search.includes('autoprint=1')) {
      window.onload = function(){ setTimeout(function(){ window.print(); }, 400); };
    }
  </script>
</body>
</html>`;
}

/** Inline preview HTML (for iframe srcDoc) */
export function buildCardPreviewHtml(opts: CardRenderOptions): string {
  return buildCardPrintHtml(opts);
}

/** Print via hidden iframe (same strategy as documents.ts) */
export function printCardHtml(html: string): void {
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
  const doPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      cleanup();
      return;
    }
    win.addEventListener?.("afterprint", cleanup);
    setTimeout(cleanup, 60_000);
  };
  setTimeout(doPrint, 300);
}

export function contextFromIdentity(
  identity: Record<string, unknown>,
  credential?: Record<string, unknown> | null,
  companyName = "SecureTrack ERP"
): FieldContext {
  return {
    full_name: String(identity.full_name || ""),
    first_name: String(identity.first_name || ""),
    last_name: String(identity.last_name || ""),
    identity_number: String(identity.identity_number || ""),
    credential_number: String(credential?.credential_number || ""),
    job_title: String(identity.job_title || ""),
    department: String(identity.department || ""),
    division: String(identity.division || ""),
    branch_name: String(identity.branch_name || ""),
    company: companyName,
    grade: String(identity.grade || ""),
    employment_type: String(identity.employment_type || ""),
    manager_name: String(identity.manager_name || ""),
    location_name: String(identity.location_name || ""),
    blood_group: String(identity.blood_group || ""),
    emergency_contact: String(identity.emergency_contact || ""),
    emergency_phone: String(identity.emergency_phone || ""),
    hire_date: String(identity.hire_date || ""),
    expiry_date: String(
      credential?.expiry_date || identity.expiry_date || ""
    ),
    issue_date: String(credential?.issue_date || ""),
    operational_role: String(identity.operational_role || ""),
    security_clearance: String(identity.security_clearance || ""),
    email: String(identity.email || ""),
    phone: String(identity.phone || ""),
    notes: String(identity.notes || ""),
    rfid_uid: String(credential?.rfid_uid || ""),
    nfc_uid: String(credential?.nfc_uid || ""),
    photo_url: String(identity.photo_url || ""),
  };
}
