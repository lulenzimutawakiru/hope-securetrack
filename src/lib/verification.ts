/** Normalize scan / paste input before sending to verify API */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeScanInput(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  // Unwrap quotes
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }

  // Deep link URL → extract code
  try {
    if (text.includes("://") || text.startsWith("http")) {
      const u = new URL(text);
      const code =
        u.searchParams.get("code") ||
        u.searchParams.get("uuid") ||
        u.searchParams.get("c") ||
        u.searchParams.get("id");
      if (code) return code.trim();
    }
  } catch {
    /* ignore */
  }

  // HST:uuid compact form
  if (/^HST[:|]/i.test(text)) {
    const parts = text.split(/[:|]/).filter(Boolean);
    if (parts[1]) return parts[1].trim();
  }

  return text;
}

export function buildLabelQrValue(publicUuid: string, appUrl: string): string {
  const base = appUrl.replace(/\/$/, "");
  // Short, camera-friendly verification URL
  return `${base}/verify?code=${publicUuid}`;
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
