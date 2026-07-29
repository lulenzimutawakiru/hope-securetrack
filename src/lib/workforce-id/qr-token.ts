/**
 * Workforce Identity QR token — signed payload for card verification.
 * Browser-safe (no env crypto keys required for client preview).
 */

export type IdentityQrPayload = {
  v: number;
  type: "WID";
  pid: string; // public id
  in: string; // identity number
  cn: string; // credential number
  exp?: string | null;
  n: string; // anti-copy nonce (short)
  ts: number;
};

export function createQrPublicId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `WID-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `WID-${Date.now().toString(36).toUpperCase()}`;
}

export function buildIdentityQrPayload(input: {
  publicId: string;
  identityNumber: string;
  credentialNumber: string;
  expiryDate?: string | null;
  nonce: string;
}): IdentityQrPayload {
  return {
    v: 1,
    type: "WID",
    pid: input.publicId,
    in: input.identityNumber,
    cn: input.credentialNumber,
    exp: input.expiryDate ?? null,
    n: input.nonce.slice(0, 12),
    ts: Date.now(),
  };
}

/** Compact token string embedded in QR (URL-safe base64 JSON) */
export function encodeIdentityQrToken(payload: IdentityQrPayload): string {
  const json = JSON.stringify(payload);
  if (typeof btoa !== "undefined") {
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeIdentityQrToken(
  token: string
): IdentityQrPayload | null {
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json =
      typeof atob !== "undefined"
        ? decodeURIComponent(escape(atob(b64 + pad)))
        : Buffer.from(b64 + pad, "base64").toString("utf8");
    const data = JSON.parse(json) as IdentityQrPayload;
    if (data.type !== "WID" || !data.pid) return null;
    return data;
  } catch {
    return null;
  }
}

/** Public verification URL fragment / path query */
export function buildVerifyUrl(
  publicId: string,
  baseUrl?: string
): string {
  const origin =
    baseUrl ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin}/dashboard/credentials/verify?pid=${encodeURIComponent(publicId)}`;
}

/** Content encoded into QR: prefer verify URL + public id for scanners */
export function buildQrContent(publicId: string, token?: string | null): string {
  if (typeof window !== "undefined") {
    return buildVerifyUrl(publicId);
  }
  return token || publicId;
}
