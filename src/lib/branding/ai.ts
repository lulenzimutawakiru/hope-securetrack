/** AI Brand Assistant */

export interface BrandAiInsight {
  type: "design" | "compliance" | "content" | "palette" | "template";
  severity: "info" | "low" | "medium" | "high";
  title: string;
  detail: string;
  actions: string[];
  sample?: string;
}

export function generateBrandInsights(params: {
  brandName?: string;
  primaryColor?: string;
  assetCount?: number;
  pendingApprovals?: number;
  openIssues?: number;
  publishedTemplates?: number;
}): BrandAiInsight[] {
  const insights: BrandAiInsight[] = [];
  const name = params.brandName || "Company";

  if ((params.pendingApprovals || 0) > 0) {
    insights.push({
      type: "template",
      severity: "medium",
      title: `${params.pendingApprovals} items in approval queue`,
      detail: "Clear marketing → brand → management reviews to keep documents compliant.",
      actions: ["Open Approvals", "Assign reviewers"],
    });
  }

  if ((params.openIssues || 0) > 0) {
    insights.push({
      type: "compliance",
      severity: "high",
      title: `${params.openIssues} open brand violations`,
      detail: "Resolve wrong colors, outdated templates, or missing legal text.",
      actions: ["Open Compliance", "Run full scan"],
    });
  }

  if ((params.assetCount || 0) < 5) {
    insights.push({
      type: "design",
      severity: "low",
      title: "Thin asset library",
      detail: "Upload logo pack, product shots, and packaging artwork to DAM.",
      actions: ["Upload assets", "Tag product images"],
    });
  }

  if ((params.publishedTemplates || 0) < 3) {
    insights.push({
      type: "template",
      severity: "info",
      title: "Expand document templates",
      detail: "Publish invoice, PO, quotation, and label templates for ERP modules.",
      actions: ["Create template", "Duplicate invoice template"],
    });
  }

  insights.push({
    type: "content",
    severity: "info",
    title: "Suggested social caption",
    detail: "Ready-to-use copy for product marketing.",
    actions: ["Copy to clipboard"],
    sample: `Discover ${name} Premium A4 — secure, traceable, enterprise-grade paper. Authenticate every ream with QR. #SecureTrackPaper #SecureTrack`,
  });

  insights.push({
    type: "design",
    severity: "info",
    title: "Label layout concept",
    detail: "Header brand strip · product name · batch · QR · security microtext.",
    actions: ["Open designer", "Create label template"],
    sample: `┌────────────────────────────┐\n│ ${name.toUpperCase().slice(0, 18).padEnd(18)} │\n│ Premium A4 · 80gsm         │\n│ Batch {{batch}}  [QR]      │\n│ AUTHENTICATE ON SCAN       │\n└────────────────────────────┘`,
  });

  if (params.primaryColor) {
    insights.push({
      type: "palette",
      severity: "info",
      title: "Accent pairing tip",
      detail: `Pair primary ${params.primaryColor} with neutral white/charcoal for AA contrast on body text.`,
      actions: ["Open colors", "Run contrast check"],
    });
  }

  return insights;
}

export function generateMarketingCopy(params: {
  productName: string;
  brandName?: string;
  tone?: "professional" | "bold" | "friendly";
}): { headline: string; body: string; cta: string } {
  const brand = params.brandName || "SecureTrack ERP";
  const tone = params.tone || "professional";
  if (tone === "bold") {
    return {
      headline: `${params.productName} — Built for Zero Compromise`,
      body: `${brand} delivers industrial-grade quality with full QR traceability from mill to market.`,
      cta: "Request a quote today",
    };
  }
  if (tone === "friendly") {
    return {
      headline: `Meet ${params.productName}`,
      body: `Smooth, reliable paper from ${brand} — trusted by teams who care about quality and authenticity.`,
      cta: "Learn more",
    };
  }
  return {
    headline: `${params.productName} by ${brand}`,
    body: `Enterprise paper engineered for print excellence and secure authentication across the supply chain.`,
    cta: "Contact sales",
  };
}

export function suggestEmailSignature(params: {
  fullName: string;
  jobTitle: string;
  phone?: string;
  brandName?: string;
  website?: string;
  primaryColor?: string;
}): string {
  const color = params.primaryColor || "#0D7377";
  const brand = params.brandName || "SecureTrack ERP";
  const web = params.website || "https://hopedesign.ug";
  return `<p style="font-family:Inter,sans-serif;font-size:13px;color:#1A1A1A">Regards,<br/><strong>${params.fullName}</strong><br/>${params.jobTitle}<br/><span style="color:${color};font-weight:600">${brand}</span><br/>${params.phone || ""} · <a href="${web}" style="color:#00AEEF">${web.replace(/^https?:\/\//, "")}</a></p>`;
}
