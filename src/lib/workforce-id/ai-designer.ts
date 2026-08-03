/**
 * AI-assisted card layout generator (rule + template based, works offline).
 * Produces professional design_json for the card studio.
 */

import type { CardDesign, CardElement } from "./types";

export type AiDesignRequest = {
  prompt: string;
  category?: string;
};

export type AiDesignResult = {
  name: string;
  category: string;
  description: string;
  security_features: string[];
  default_access_profile_code: string;
  design_json: CardDesign;
  recommendations: string[];
};

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function detectCategory(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("visitor") || p.includes("guest")) return "visitor";
  if (p.includes("security") || p.includes("guard") || p.includes("patrol"))
    return "security";
  if (
    p.includes("factory") ||
    p.includes("production") ||
    p.includes("operator") ||
    p.includes("warehouse") ||
    p.includes("machine")
  )
    return "factory";
  if (
    p.includes("executive") ||
    p.includes("ceo") ||
    p.includes("director") ||
    p.includes("manager") ||
    p.includes("premium")
  )
    return "executive";
  if (p.includes("contractor") || p.includes("consultant")) return "contractor";
  if (p.includes("intern")) return "intern";
  return "employee";
}

function baseFront(
  theme: { bg: string; bar: string; text: string; accent: string; title: string }
): CardElement[] {
  return [
    {
      id: uid("bg"),
      type: "rect",
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      fill: theme.bg,
      z: 0,
    },
    {
      id: uid("bar"),
      type: "rect",
      x: 0,
      y: 0,
      w: 100,
      h: 18,
      fill: theme.bar,
      z: 1,
    },
    {
      id: uid("logo"),
      type: "text",
      x: 3,
      y: 4,
      w: 70,
      h: 10,
      text: theme.title,
      fontSize: 9,
      color: "#ffffff",
      bold: true,
      z: 2,
    },
    {
      id: uid("photo"),
      type: "photo",
      x: 4,
      y: 24,
      w: 26,
      h: 44,
      z: 3,
    },
    {
      id: uid("name"),
      type: "field",
      x: 34,
      y: 26,
      w: 42,
      h: 12,
      field: "full_name",
      fontSize: 13,
      color: theme.text,
      bold: true,
      z: 4,
    },
    {
      id: uid("title"),
      type: "field",
      x: 34,
      y: 40,
      w: 42,
      h: 8,
      field: "job_title",
      fontSize: 9,
      color: theme.accent,
      z: 5,
    },
    {
      id: uid("dept"),
      type: "field",
      x: 34,
      y: 50,
      w: 42,
      h: 8,
      field: "department",
      fontSize: 9,
      color: theme.text,
      z: 6,
    },
    {
      id: uid("id"),
      type: "field",
      x: 34,
      y: 62,
      w: 42,
      h: 8,
      field: "identity_number",
      fontSize: 9,
      fontFamily: "monospace",
      color: theme.bar,
      z: 7,
    },
    { id: uid("qr"), type: "qr", x: 76, y: 28, w: 20, h: 20, z: 8 },
    {
      id: uid("holo"),
      type: "hologram",
      x: 76,
      y: 52,
      w: 20,
      h: 12,
      z: 9,
    },
    {
      id: uid("foot"),
      type: "text",
      x: 4,
      y: 90,
      w: 70,
      h: 6,
      text: "SECURETRACK GROUP LTD",
      fontSize: 7,
      color: theme.accent,
      bold: true,
      z: 10,
    },
  ];
}

function baseBack(extra: string): CardElement[] {
  return [
    {
      id: uid("bbg"),
      type: "rect",
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      fill: "#f8fafc",
      z: 0,
    },
    {
      id: uid("wm"),
      type: "watermark",
      x: 10,
      y: 30,
      w: 80,
      h: 40,
      text: "SECURETRACK",
      z: 1,
    },
    {
      id: uid("bh"),
      type: "text",
      x: 4,
      y: 6,
      w: 92,
      h: 8,
      text: "Official Credential — SecureTrack ERP",
      fontSize: 9,
      bold: true,
      z: 2,
    },
    {
      id: uid("em"),
      type: "field",
      x: 4,
      y: 20,
      w: 92,
      h: 8,
      field: "emergency_contact",
      label: "Emergency",
      fontSize: 9,
      z: 3,
    },
    {
      id: uid("bg"),
      type: "field",
      x: 4,
      y: 32,
      w: 40,
      h: 8,
      field: "blood_group",
      label: "Blood",
      fontSize: 9,
      z: 4,
    },
    {
      id: uid("exp"),
      type: "field",
      x: 50,
      y: 32,
      w: 45,
      h: 8,
      field: "expiry_date",
      label: "Expires",
      fontSize: 9,
      z: 5,
    },
    {
      id: uid("rules"),
      type: "text",
      x: 4,
      y: 48,
      w: 92,
      h: 24,
      text: extra,
      fontSize: 8,
      color: "#475569",
      z: 6,
    },
    {
      id: uid("bc"),
      type: "barcode",
      x: 10,
      y: 74,
      w: 80,
      h: 16,
      field: "credential_number",
      z: 7,
    },
    {
      id: uid("micro"),
      type: "microtext",
      x: 2,
      y: 94,
      w: 96,
      h: 4,
      z: 8,
    },
  ];
}

/** Generate a full card design from natural language */
export function generateCardDesign(req: AiDesignRequest): AiDesignResult {
  const category = req.category || detectCategory(req.prompt);
  const p = req.prompt.toLowerCase();

  const themes: Record<
    string,
    {
      bg: string;
      bar: string;
      text: string;
      accent: string;
      title: string;
      name: string;
      profile: string;
      features: string[];
      back: string;
      desc: string;
    }
  > = {
    executive: {
      bg: "#0f172a",
      bar: "#0f766e",
      text: "#ffffff",
      accent: "#fbbf24",
      title: "SECURETRACK · EXECUTIVE",
      name: "AI Executive Card",
      profile: "EXEC",
      features: ["qr", "hologram", "watermark", "security_seal", "microtext"],
      back: "Executive access. Report loss to Security immediately. Confidential.",
      desc: "Premium dark executive badge with enhanced security features",
    },
    factory: {
      bg: "#ffffff",
      bar: "#0f766e",
      text: "#0f172a",
      accent: "#0f766e",
      title: "SECURETRACK · PRODUCTION",
      name: "AI Factory Worker Badge",
      profile: "PROD-STD",
      features: ["qr", "barcode", "microtext", "hologram"],
      back: "Wear badge on production floor. PPE required. Report loss to Security.",
      desc: "High-contrast factory credential optimized for readability",
    },
    security: {
      bg: "#111827",
      bar: "#dc2626",
      text: "#ffffff",
      accent: "#fca5a5",
      title: "SECURITY AUTHORIZATION",
      name: "AI Security Badge",
      profile: "SEC-ALL",
      features: ["qr", "hologram", "uv_pattern", "security_seal", "microtext"],
      back: "Patrol authorized. Restricted zones require escort protocol.",
      desc: "High-security officer badge with patrol authorization",
    },
    visitor: {
      bg: "#fff7ed",
      bar: "#ea580c",
      text: "#0f172a",
      accent: "#c2410c",
      title: "VISITOR",
      name: "AI Visitor Badge",
      profile: "VISITOR",
      features: ["qr", "expiry"],
      back: "Escort required. Return badge at exit. Photography restricted.",
      desc: "Temporary visitor credential with clear expiry",
    },
    contractor: {
      bg: "#f8fafc",
      bar: "#7c3aed",
      text: "#0f172a",
      accent: "#6d28d9",
      title: "CONTRACTOR",
      name: "AI Contractor Card",
      profile: "PROD-STD",
      features: ["qr", "barcode", "expiry"],
      back: "Contractor access per assignment. Valid only with active PO/contract.",
      desc: "Contractor credential with limited duration cues",
    },
    intern: {
      bg: "#f0fdf4",
      bar: "#16a34a",
      text: "#14532d",
      accent: "#15803d",
      title: "INTERN",
      name: "AI Intern Card",
      profile: "PROD-STD",
      features: ["qr", "expiry"],
      back: "Intern access. Supervised zones only. Return on end of placement.",
      desc: "Intern badge with supervised-access messaging",
    },
    employee: {
      bg: "#ffffff",
      bar: "#0f766e",
      text: "#0f172a",
      accent: "#0f766e",
      title: "SECURETRACK GROUP",
      name: "AI Employee Card",
      profile: "PROD-STD",
      features: ["qr", "barcode", "hologram", "microtext"],
      back: "Official employee ID. If found return to SecureTrack ERP, Kampala.",
      desc: "Corporate employee ID with standard security features",
    },
  };

  const t = themes[category] || themes.employee;
  const design: CardDesign = {
    front: baseFront(t),
    back: baseBack(t.back),
  };

  // Prompt-driven tweaks
  if (p.includes("portrait")) {
    // keep landscape CR80 but note in recommendations
  }
  if (p.includes("no photo") || p.includes("without photo")) {
    design.front = design.front.filter((e) => e.type !== "photo");
  }
  if (p.includes("nfc") || p.includes("rfid")) {
    design.front.push({
      id: uid("rfid"),
      type: "field",
      x: 34,
      y: 72,
      w: 40,
      h: 6,
      field: "rfid_uid",
      label: "RFID",
      fontSize: 7,
      fontFamily: "monospace",
      color: t.accent,
      z: 12,
    });
    t.features = [...new Set([...t.features, "rfid"])];
  }

  const recommendations = [
    "Align photo left and dynamic fields right for scannability",
    "Keep QR ≥ 18% of card width for reliable mobile scans",
    "Use monospace for identity numbers",
    "Print test strip before batch (color registration)",
    category === "security"
      ? "Enable UV / hologram laminate for security badges"
      : "Add guilloche background for anti-counterfeit",
    "Set expiry and auto-renewal notifications 30 days prior",
  ];

  return {
    name: t.name,
    category,
    description: t.desc,
    security_features: t.features,
    default_access_profile_code: t.profile,
    design_json: design,
    recommendations,
  };
}

/** Simple printability / layout checks */
export function analyzeDesign(design: CardDesign): string[] {
  const issues: string[] = [];
  const front = design.front || [];
  if (!front.some((e) => e.type === "qr")) {
    issues.push("No QR code on front — digital verification will fail");
  }
  if (!front.some((e) => e.type === "photo" || e.type === "field")) {
    issues.push("Missing photo or name fields — identity hard to validate visually");
  }
  const nameField = front.find((e) => e.field === "full_name");
  if (nameField && (nameField.fontSize || 10) < 10) {
    issues.push("Full name font may be too small for readability (< 10pt)");
  }
  const qr = front.find((e) => e.type === "qr");
  if (qr && qr.w < 15) {
    issues.push("QR code width < 15% — may not scan reliably");
  }
  const overlaps = front.filter(
    (e) => e.type === "text" || e.type === "field"
  );
  if (overlaps.length > 12) {
    issues.push("Many text layers — consider simplifying for print clarity");
  }
  if (!(design.back || []).length) {
    issues.push("Back side empty — add emergency contact and barcode");
  }
  if (!issues.length) {
    issues.push("Layout looks print-ready");
  }
  return issues;
}
