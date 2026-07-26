export async function computeChecksum(payload: Record<string, unknown>): Promise<string> {
  const { checksum: _, ...rest } = payload;
  const sorted = JSON.stringify(rest, Object.keys(rest).sort());
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sorted)
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyChecksum(payload: Record<string, unknown>): Promise<boolean> {
  const expected = payload.checksum as string;
  if (!expected) return false;
  const computed = await computeChecksum(payload);
  return computed === expected;
}
