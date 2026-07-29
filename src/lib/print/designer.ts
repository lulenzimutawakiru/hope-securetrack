/** Label designer defaults & HTML preview */

import type { CanvasLayout, LabelElement } from "./types";
import { barcodePreviewBars, qrPreviewDataUrl } from "./codes";

export function defaultCanvas(w = 50, h = 30): CanvasLayout {
  return {
    canvas: { w, h },
    elements: [
      { id: "el-logo", type: "logo", x: 2, y: 2, w: 10, h: 6 },
      { id: "el-name", type: "text", field: "product_name", text: "{{product_name}}", x: 14, y: 2, w: 34, h: 6 },
      { id: "el-qr", type: "qr", field: "qr_payload", x: 2, y: 10, size: 16 },
      { id: "el-serial", type: "text", field: "serial", text: "{{serial}}", x: 20, y: 12, w: 28, h: 4 },
      { id: "el-batch", type: "text", field: "batch", text: "Batch {{batch}}", x: 20, y: 17, w: 28, h: 4 },
      { id: "el-bc", type: "barcode", field: "serial", symbology: "code128", x: 20, y: 22, w: 28, h: 6 },
    ],
  };
}

export function addElement(layout: CanvasLayout, type: string): CanvasLayout {
  const id = `el-${Date.now().toString(36)}`;
  const el: LabelElement = {
    id,
    type,
    x: 4,
    y: 4,
    w: type === "qr" ? 16 : 20,
    h: type === "qr" ? 16 : 6,
    field: type === "text" ? "label" : type,
    text: type === "text" ? "New text" : undefined,
    symbology: type === "barcode" ? "code128" : undefined,
    size: type === "qr" ? 16 : undefined,
  };
  return { ...layout, elements: [...layout.elements, el] };
}

export function applyVariables(
  text: string,
  vars: Record<string, string>
): string {
  let out = text || "";
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "gi"), v ?? "");
  }
  return out.replace(/\{\{[^}]+\}\}/g, "");
}

export function renderLabelHtml(
  layout: CanvasLayout,
  vars: Record<string, string> = {},
  opts?: { securityWatermark?: string; companyName?: string }
): string {
  const scale = 4; // mm → px approx for screen
  const W = layout.canvas.w * scale;
  const H = layout.canvas.h * scale;
  const product = vars.product_name || "Premium A4";
  const serial = vars.serial || "HDG-REAM-000001";
  const batch = vars.batch || "B240722A";
  const qrPayload = vars.qr_payload || vars.verify_url || serial;
  const qr = qrPreviewDataUrl(qrPayload, 64);
  const bc = barcodePreviewBars(serial, 120, 28);

  const parts = layout.elements.map((el) => {
    const left = el.x * scale;
    const top = el.y * scale;
    if (el.type === "qr") {
      return `<img src="${qr}" alt="QR" style="position:absolute;left:${left}px;top:${top}px;width:${(el.size || 16) * scale}px;height:${(el.size || 16) * scale}px"/>`;
    }
    if (el.type === "barcode") {
      return `<img src="${bc}" alt="BC" style="position:absolute;left:${left}px;top:${top}px;width:${(el.w || 28) * scale}px;height:${(el.h || 6) * scale}px"/>`;
    }
    if (el.type === "logo") {
      return `<div style="position:absolute;left:${left}px;top:${top}px;font-size:9px;font-weight:700;color:#0D7377">${opts?.companyName?.slice(0, 12) || "HDG"}</div>`;
    }
    if (el.type === "security") {
      return `<div style="position:absolute;left:${left}px;top:${top}px;font-size:7px;color:#999;letter-spacing:1px">${opts?.securityWatermark || "SECURE"}</div>`;
    }
    const raw = el.text || (el.field ? `{{${el.field}}}` : "");
    const text = applyVariables(raw, {
      product_name: product,
      serial,
      batch,
      ...vars,
    });
    return `<div style="position:absolute;left:${left}px;top:${top}px;font-size:10px;font-family:Inter,sans-serif">${text}</div>`;
  });

  const wm = opts?.securityWatermark
    ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0.08;font-size:14px;transform:rotate(-20deg);pointer-events:none;font-weight:700">${opts.securityWatermark}</div>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{margin:16px;font-family:Inter,system-ui,sans-serif;background:#f4f4f5}
    .label{position:relative;width:${W}px;height:${H}px;background:#fff;border:1px dashed #ccc;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .meta{margin-top:8px;font-size:11px;color:#666}
  </style></head><body>
  <div class="label">${parts.join("")}${wm}</div>
  <div class="meta">${layout.canvas.w}×${layout.canvas.h} mm · ${serial}</div>
  </body></html>`;
}

export function layoutFromTemplateJson(json: unknown, w = 50, h = 30): CanvasLayout {
  if (json && typeof json === "object" && "elements" in (json as object)) {
    const j = json as { canvas?: { w: number; h: number }; elements?: LabelElement[] };
    return {
      canvas: j.canvas || { w, h },
      elements: (j.elements || []).map((e, i) => ({
        id: e.id || `el-${i}`,
        type: e.type,
        x: e.x ?? 0,
        y: e.y ?? 0,
        w: e.w,
        h: e.h,
        field: e.field,
        text: e.text,
        symbology: e.symbology,
        size: e.size,
      })),
    };
  }
  if (json && typeof json === "object" && "elements" in (json as { elements?: unknown[] })) {
    // seed format without canvas
  }
  // seed layout_json with elements array only
  const els = (json as { elements?: Array<Record<string, unknown>> })?.elements;
  if (Array.isArray(els)) {
    return {
      canvas: { w, h },
      elements: els.map((e, i) => ({
        id: `el-${i}`,
        type: String(e.type || "text"),
        x: Number(e.x || 0),
        y: Number(e.y || 0),
        w: e.w != null ? Number(e.w) : undefined,
        h: e.h != null ? Number(e.h) : undefined,
        field: e.field != null ? String(e.field) : undefined,
        text: e.field ? `{{${e.field}}}` : undefined,
        symbology: e.symbology != null ? String(e.symbology) : undefined,
        size: e.size != null ? Number(e.size) : undefined,
      })),
    };
  }
  return defaultCanvas(w, h);
}
