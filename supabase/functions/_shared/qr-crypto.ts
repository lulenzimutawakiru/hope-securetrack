import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/, "");
  if (clean.length % 2 !== 0) {
    throw new Error("Invalid hex key length");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
  }
  return bytes;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function getEncryptionKeyBytes(): Uint8Array {
  const raw = Deno.env.get("QR_ENCRYPTION_KEY") ?? "";
  if (!raw) throw new Error("QR_ENCRYPTION_KEY is not set");

  // Prefer 64-char hex (AES-256). Fall back to UTF-8 padded/truncated to 32 bytes.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return hexToBytes(raw);
  }
  const encoded = new TextEncoder().encode(raw);
  const out = new Uint8Array(32);
  out.set(encoded.slice(0, 32));
  return out;
}

function getSigningSecretBytes(): Uint8Array {
  const raw =
    Deno.env.get("QR_SIGNING_PRIVATE_KEY") ??
    Deno.env.get("QR_ENCRYPTION_KEY") ??
    "";
  if (!raw) throw new Error("QR_SIGNING_PRIVATE_KEY is not set");

  // Accept base64, hex, or plain secret string
  try {
    if (/^[0-9a-fA-F]{32,}$/.test(raw) && raw.length % 2 === 0) {
      return hexToBytes(raw);
    }
    if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length >= 16) {
      const decoded = base64ToBytes(raw);
      if (decoded.length >= 16) return decoded;
    }
  } catch {
    // fall through
  }
  return new TextEncoder().encode(raw);
}

async function importAesKey(usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(getEncryptionKeyBytes()),
    { name: "AES-GCM" },
    false,
    usages
  );
}

async function importHmacKey(usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(getSigningSecretBytes()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages
  );
}

async function hmacSign(data: string): Promise<string> {
  const key = await importHmacKey(["sign"]);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return bytesToBase64(new Uint8Array(sig));
}

async function hmacVerify(data: string, signature: string): Promise<boolean> {
  try {
    const key = await importHmacKey(["verify"]);
    return await crypto.subtle.verify(
      "HMAC",
      key,
      toArrayBuffer(base64ToBytes(signature)),
      new TextEncoder().encode(data)
    );
  } catch {
    return false;
  }
}

async function computeChecksum(payload: Record<string, unknown>): Promise<string> {
  const { checksum: _c, ...rest } = payload;
  const sortedKeys = Object.keys(rest).sort();
  const data = JSON.stringify(rest, sortedKeys);
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data)
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function encryptToken(data: Record<string, unknown>): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importAesKey(["encrypt"]);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(data))
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return bytesToBase64(combined);
}

async function decryptToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const combined = base64ToBytes(token);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const key = await importAesKey(["decrypt"]);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    return null;
  }
}

export interface VerificationResult {
  valid: boolean;
  result: "genuine" | "invalid" | "counterfeit" | "recalled";
  message: string;
  companyId?: string;
  qrCode?: Record<string, unknown>;
  product?: Record<string, unknown>;
  batch?: Record<string, unknown>;
}

export async function verifyQrPayload(
  payload: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<VerificationResult> {
  const required = ["version", "type", "uuid", "token", "signature", "checksum"];
  for (const field of required) {
    if (!payload[field]) {
      return { valid: false, result: "invalid", message: "Missing required field: " + field };
    }
  }

  const expectedChecksum = await computeChecksum(payload);
  if (expectedChecksum !== payload.checksum) {
    return { valid: false, result: "counterfeit", message: "Checksum verification failed" };
  }

  const signData = JSON.stringify({
    version: payload.version,
    type: payload.type,
    uuid: payload.uuid,
    token: payload.token,
  });

  if (!(await hmacVerify(signData, payload.signature as string))) {
    return { valid: false, result: "counterfeit", message: "Digital signature invalid" };
  }

  const decrypted = await decryptToken(payload.token as string);
  if (!decrypted) {
    return { valid: false, result: "counterfeit", message: "Token decryption failed" };
  }

  const { data: qrCode, error } = await supabase
    .from("qr_codes")
    .select("*")
    .eq("public_uuid", payload.uuid)
    .single();

  if (error || !qrCode) {
    return { valid: false, result: "invalid", message: "Unknown QR code" };
  }

  if (qrCode.status === "counterfeit" || qrCode.status === "voided") {
    return {
      valid: false,
      result: "counterfeit",
      message: "QR code flagged as counterfeit",
      companyId: qrCode.company_id,
      qrCode,
    };
  }

  return {
    valid: true,
    result: qrCode.is_recalled ? "recalled" : "genuine",
    message: "Verification successful",
    companyId: qrCode.company_id,
    qrCode,
  };
}

export async function generateQrPayload(
  type: "REAM" | "CARTON",
  internalData: Record<string, unknown>,
  publicUuid?: string
): Promise<Record<string, unknown>> {
  const uuid = publicUuid ?? crypto.randomUUID();
  const token = await encryptToken(internalData);

  const signPayload = { version: 1, type, uuid, token };
  const signString = JSON.stringify(signPayload);
  const signature = await hmacSign(signString);

  const payloadWithoutChecksum = { ...signPayload, signature };
  const checksum = await computeChecksum(payloadWithoutChecksum);

  return { ...payloadWithoutChecksum, checksum };
}
