/** Document branding engine — apply brand tokens to templates */

export interface BrandTokens {
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  company_website?: string;
  tax_number?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string;
  [key: string]: string | undefined;
}

export function applyTemplate(
  html: string,
  tokens: BrandTokens
): string {
  let out = html || "";
  for (const [key, value] of Object.entries(tokens)) {
    const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
    out = out.replace(re, value ?? "");
  }
  // leftover empty tokens
  out = out.replace(/\{\{[^}]+\}\}/g, "");
  return out;
}

export function buildDocumentHtml(params: {
  header_html?: string | null;
  body_html?: string | null;
  footer_html?: string | null;
  tokens: BrandTokens;
  title?: string;
}): string {
  const primary = params.tokens.primary_color || "#0D7377";
  const header = applyTemplate(params.header_html || "", params.tokens);
  const body = applyTemplate(params.body_html || "", params.tokens);
  const footer = applyTemplate(params.footer_html || "", params.tokens);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${params.title || "Document"}</title>
<style>
  body { font-family: Inter, system-ui, sans-serif; color: #1a1a1a; margin: 32px; }
  a { color: ${primary}; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e5e5e5; padding: 6px 8px; text-align: left; font-size: 12px; }
  th { background: ${primary}15; }
</style>
</head>
<body>
  <header>${header}</header>
  <main style="margin: 24px 0">${body}</main>
  <footer>${footer}</footer>
</body>
</html>`;
}

export function defaultLayoutJson(canvas: string) {
  return {
    canvas,
    components: [
      { type: "logo", x: 20, y: 20, w: 120, h: 48 },
      { type: "text", x: 160, y: 24, w: 300, h: 40, text: "{{company_name}}" },
      { type: "table", x: 20, y: 100, w: 555, h: 200 },
      { type: "qr", x: 500, y: 20, w: 64, h: 64 },
      { type: "footer", x: 20, y: 760, w: 555, h: 40 },
    ],
  };
}
