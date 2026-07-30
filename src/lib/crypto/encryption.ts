function getKeyBytes(): Uint8Array {
  const hex = (process.env.QR_ENCRYPTION_KEY ?? "").trim();
  if (!hex || hex.length < 64) {
    // Fail closed: 32-byte hex key required for AES-256-GCM
    throw new Error(
      "QR_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Refusing weak encryption."
    );
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 64; i += 2) {
    const n = parseInt(hex.substr(i, 2), 16);
    if (Number.isNaN(n)) {
      throw new Error("QR_ENCRYPTION_KEY contains non-hex characters");
    }
    bytes[i / 2] = n;
  }
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

export async function encryptToken(data: Record<string, unknown>): Promise<string> {
  const keyBytes = getKeyBytes();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await crypto.subtle.importKey(
    "raw",
    asBufferSource(keyBytes),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(data))
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return toBase64(combined);
}

export async function decryptToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const combined = fromBase64(token);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const keyBytes = getKeyBytes();

    const key = await crypto.subtle.importKey(
      "raw",
      asBufferSource(keyBytes),
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asBufferSource(iv) },
      key,
      asBufferSource(ciphertext)
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    return null;
  }
}
