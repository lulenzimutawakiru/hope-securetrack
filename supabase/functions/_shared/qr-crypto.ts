import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const ENCRYPTION_KEY = Deno.env.get("QR_ENCRYPTION_KEY")!;
const SIGNING_PUBLIC_KEY = Deno.env.get("QR_SIGNING_PUBLIC_KEY")!;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifySignature(data: string, signature: string): Promise<boolean> {
  try {
    const publicKeyBytes = base64ToBytes(SIGNING_PUBLIC_KEY);
    const key = await crypto.subtle.importKey(
      "raw",
      publicKeyBytes,
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    const sigBytes = base64ToBytes(signature);
    const dataBytes = new TextEncoder().encode(data);
    return await crypto.subtle.verify("Ed25519", key, sigBytes, dataBytes);
  } catch {
    return false;
  }
}

async function verifyChecksum(payload: Record<string, unknown>): Promise<boolean> {
  const { checksum, ...rest } = payload;
  const data = JSON.stringify(rest, Object.keys(rest).sort());
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex === checksum;
}

async function decryptToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const combined = base64ToBytes(token);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const keyBytes = hexToBytes(ENCRYPTION_KEY);

    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
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

  if (!(await verifyChecksum(payload))) {
    return { valid: false, result: "counterfeit", message: "Checksum verification failed" };
  }

  const signData = JSON.stringify({
    version: payload.version,
    type: payload.type,
    uuid: payload.uuid,
    token: payload.token,
  });

  if (!(await verifySignature(signData, payload.signature as string))) {
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
    return { valid: false, result: "counterfeit", message: "QR code flagged as counterfeit", companyId: qrCode.company_id, qrCode };
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
  internalData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const uuid = crypto.randomUUID();
  const SIGNING_PRIVATE_KEY = Deno.env.get("QR_SIGNING_PRIVATE_KEY")!;

  const tokenData = JSON.stringify(internalData);
  const keyBytes = hexToBytes(ENCRYPTION_KEY);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(tokenData)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  const token = btoa(String.fromCharCode(...combined));

  const signPayload = { version: 1, type, uuid, token };
  const signData = JSON.stringify(signPayload);

  const privateKeyBytes = base64ToBytes(SIGNING_PRIVATE_KEY);
  const privateKey = await crypto.subtle.importKey(
    "raw",
    privateKeyBytes,
    { name: "Ed25519" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "Ed25519",
    privateKey,
    new TextEncoder().encode(signData)
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  const payloadWithoutChecksum = { version: 1, type, uuid, token, signature };
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(payloadWithoutChecksum, Object.keys(payloadWithoutChecksum).sort()))
  );
  const checksum = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { ...payloadWithoutChecksum, checksum };
}
