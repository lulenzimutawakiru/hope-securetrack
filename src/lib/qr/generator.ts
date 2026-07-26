import { uuidv7 } from "uuidv7";
import { encryptToken } from "@/lib/crypto/encryption";
import { signPayload } from "@/lib/crypto/signatures";
import { computeChecksum } from "@/lib/crypto/checksum";

export interface QrPayload {
  version: number;
  type: "REAM" | "CARTON";
  uuid: string;
  token: string;
  signature: string;
  checksum: string;
}

export interface QrInternalData {
  serial: string;
  batchNumber: string;
  productCode: string;
  paperSize?: string;
  gsm?: number;
  manufacturingDate?: string;
  generatedAt: string;
  [key: string]: unknown;
}

export async function generateQrPayload(
  type: "REAM" | "CARTON",
  internalData: QrInternalData
): Promise<{ payload: QrPayload; publicUuid: string }> {
  const publicUuid = uuidv7();
  const token = await encryptToken(internalData);

  const signData = JSON.stringify({
    version: 1,
    type,
    uuid: publicUuid,
    token,
  });

  const signature = await signPayload(signData);

  const payloadWithoutChecksum = {
    version: 1,
    type,
    uuid: publicUuid,
    token,
    signature,
  };

  const checksum = await computeChecksum(payloadWithoutChecksum);

  return {
    publicUuid,
    payload: { ...payloadWithoutChecksum, checksum },
  };
}

export function serializeQrPayload(payload: QrPayload): string {
  return JSON.stringify(payload);
}
