/** Brand compliance checks */

export interface ComplianceFinding {
  issue_type: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  entity_type?: string;
  entity_id?: string;
}

export function checkColorAgainstPalette(
  hex: string,
  palette: string[],
  tolerance = 0
): boolean {
  const n = hex.toUpperCase().replace(/^#/, "");
  return palette.some((p) => {
    const q = p.toUpperCase().replace(/^#/, "");
    if (q === n) return true;
    if (tolerance <= 0) return false;
    // simple channel distance
    const d = (a: string, b: string) =>
      Math.abs(parseInt(a, 16) - parseInt(b, 16));
    return (
      d(n.slice(0, 2), q.slice(0, 2)) +
        d(n.slice(2, 4), q.slice(2, 4)) +
        d(n.slice(4, 6), q.slice(4, 6)) <=
      tolerance * 3
    );
  });
}

export function scanTemplatesForCompliance(params: {
  templates: Array<{
    id: string;
    name: string;
    status: string;
    version: number;
    published_at?: string | null;
    html_body?: string | null;
    header_html?: string | null;
  }>;
  approvedColors: string[];
  primaryColor?: string;
}): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];
  const published = params.templates.filter((t) => t.status === "published");
  const draftsPending = params.templates.filter((t) =>
    ["draft", "marketing_review", "brand_review", "management_review"].includes(t.status)
  );

  if (draftsPending.length > 5) {
    findings.push({
      issue_type: "outdated_template",
      title: `${draftsPending.length} templates awaiting approval`,
      description: "Clear the brand approval queue to reduce non-compliant usage risk.",
      severity: "medium",
    });
  }

  for (const t of published) {
    const blob = `${t.header_html || ""}${t.html_body || ""}`;
    if (params.primaryColor && blob && !blob.includes(params.primaryColor.replace("#", ""))) {
      // only flag if hex appears nowhere and body is non-empty
      if (blob.includes("#") && !checkColorAgainstPalette(params.primaryColor, extractHexes(blob), 5)) {
        findings.push({
          issue_type: "wrong_color",
          title: `Template may not use primary brand color: ${t.name}`,
          description: "Review header/body colors against approved palette.",
          severity: "low",
          entity_type: "template",
          entity_id: t.id,
        });
      }
    }
    if (!blob.includes("{{") && t.status === "published") {
      // soft note only for empty placeholders
    }
  }

  return findings;
}

export function scanAssetsExpiry(
  assets: Array<{ id: string; title: string; expires_on?: string | null; status?: string }>
): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];
  const now = Date.now();
  for (const a of assets) {
    if (!a.expires_on) continue;
    const left = new Date(a.expires_on).getTime() - now;
    if (left < 0) {
      findings.push({
        issue_type: "outdated_template",
        title: `Expired asset: ${a.title}`,
        description: "Asset past expiry date — archive or renew.",
        severity: "high",
        entity_type: "asset",
        entity_id: a.id,
      });
    } else if (left < 30 * 864e5) {
      findings.push({
        issue_type: "outdated_template",
        title: `Expiring asset: ${a.title}`,
        description: `Expires within ${Math.ceil(left / 864e5)} days.`,
        severity: "medium",
        entity_type: "asset",
        entity_id: a.id,
      });
    }
  }
  return findings;
}

function extractHexes(text: string): string[] {
  const m = text.match(/#([0-9a-fA-F]{3,8})\b/g) || [];
  return m;
}
