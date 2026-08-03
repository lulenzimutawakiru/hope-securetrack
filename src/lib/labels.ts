/** Label layout helpers for SecureTrack ERP product authentication labels */

export const LABEL_SIZES = {
  ream: { widthMm: 50, heightMm: 30, name: "Ream 50×30mm" },
  carton: { widthMm: 70, heightMm: 50, name: "Carton 70×50mm" },
  sheet: { cols: 3, rows: 8 },
} as const;

export interface LabelData {
  id: string;
  serial: string;
  publicUuid: string;
  qrData: string;
  productName?: string;
  productCode?: string;
  paperSize?: string | null;
  gsm?: number | null;
  batchNumber?: string;
  codeType: string;
  manufacturingDate?: string;
  companyName?: string;
}

export function buildVerificationQrPayload(
  payload: Record<string, unknown>
): string {
  return JSON.stringify(payload);
}

export function labelVerifyHint(appUrl: string): string {
  return `Scan to verify · ${appUrl.replace(/^https?:\/\//, "")}/verify`;
}
