function fromBase64(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  return btoa(String.fromCharCode(...bytes));
}

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

export async function signPayload(data: string): Promise<string> {
  const privateKeyBytes = fromBase64(process.env.QR_SIGNING_PRIVATE_KEY ?? "");
  const key = await crypto.subtle.importKey(
    "raw",
    asBufferSource(privateKeyBytes),
    { name: "Ed25519" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "Ed25519",
    key,
    new TextEncoder().encode(data)
  );

  return toBase64(new Uint8Array(signature));
}

export async function verifySignature(data: string, signature: string): Promise<boolean> {
  try {
    const publicKeyBytes = fromBase64(process.env.QR_SIGNING_PUBLIC_KEY ?? "");
    const key = await crypto.subtle.importKey(
      "raw",
      asBufferSource(publicKeyBytes),
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify(
      "Ed25519",
      key,
      asBufferSource(fromBase64(signature)),
      new TextEncoder().encode(data)
    );
  } catch {
    return false;
  }
}
