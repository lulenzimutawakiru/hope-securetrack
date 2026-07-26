import { decryptToken } from "@/lib/crypto/encryption";
import { verifySignature } from "@/lib/crypto/signatures";
import { verifyChecksum } from "@/lib/crypto/checksum";
import type { QrPayload } from "@/lib/qr/generator";

export interface ValidationResult {
  valid: boolean;
  result: "genuine" | "invalid" | "counterfeit";
  message: string;
  decrypted?: Record<string, unknown>;
}

export async function validateQrPayload(
  payload: QrPayload
): Promise<ValidationResult> {
  const required: (keyof QrPayload)[] = [
    "version",
    "type",
    "uuid",
    "token",
    "signature",
    "checksum",
  ];

  for (const field of required) {
    if (!payload[field]) {
      return {
        valid: false,
        result: "invalid",
        message: `Missing field: ${field}`,
      };
    }
  }

  if (!(await verifyChecksum(payload as unknown as Record<string, unknown>))) {
    return {
      valid: false,
      result: "counterfeit",
      message: "Checksum verification failed",
    };
  }

  const signData = JSON.stringify({
    version: payload.version,
    type: payload.type,
    uuid: payload.uuid,
    token: payload.token,
  });

  if (!(await verifySignature(signData, payload.signature))) {
    return {
      valid: false,
      result: "counterfeit",
      message: "Digital signature invalid",
    };
  }

  const decrypted = await decryptToken(payload.token);
  if (!decrypted) {
    return {
      valid: false,
      result: "counterfeit",
      message: "Token decryption failed",
    };
  }

  return {
    valid: true,
    result: "genuine",
    message: "Payload cryptographically valid",
    decrypted,
  };
}
