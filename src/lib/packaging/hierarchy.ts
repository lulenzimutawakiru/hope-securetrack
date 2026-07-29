/** QR authentication hierarchy: Pallet → Carton → Ream */

import type { QrHierarchyNode } from "./types";

export function buildSerial(prefix: string, seq: number, width = 6): string {
  return `${prefix}-${String(seq).padStart(width, "0")}`;
}

export function reamQrPayload(serial: string, batch?: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://hope-securetrack.vercel.app";
  return `${base}/verify?s=${encodeURIComponent(serial)}${batch ? `&b=${encodeURIComponent(batch)}` : ""}`;
}

export function cartonQrPayload(serial: string, reamSerials: string[]): string {
  return JSON.stringify({
    t: "carton",
    sn: serial,
    reams: reamSerials,
    n: reamSerials.length,
  });
}

export function palletQrPayload(serial: string, cartonSerials: string[]): string {
  return JSON.stringify({
    t: "pallet",
    sn: serial,
    cartons: cartonSerials,
    n: cartonSerials.length,
  });
}

/**
 * Build hierarchy tree for UI visualization.
 */
export function buildHierarchyTree(input: {
  palletSerial: string;
  cartons: Array<{ serial: string; reams: string[] }>;
}): QrHierarchyNode {
  return {
    level: "pallet",
    serial: input.palletSerial,
    qr_payload: palletQrPayload(
      input.palletSerial,
      input.cartons.map((c) => c.serial)
    ),
    children: input.cartons.map((c) => ({
      level: "carton" as const,
      serial: c.serial,
      qr_payload: cartonQrPayload(c.serial, c.reams),
      children: c.reams.map((r) => ({
        level: "ream" as const,
        serial: r,
        qr_payload: reamQrPayload(r),
      })),
    })),
  };
}

export function validateCartonReams(
  reamSerials: string[],
  expected: number
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (reamSerials.length !== expected) {
    errors.push(`Expected ${expected} reams, got ${reamSerials.length}`);
  }
  const unique = new Set(reamSerials.map((s) => s.toUpperCase()));
  if (unique.size !== reamSerials.length) {
    errors.push("Duplicate ream serials detected");
  }
  return { ok: errors.length === 0, errors };
}

export function weightStatus(
  grossKg: number,
  expectedKg: number,
  tolerancePct = 5
): "ok" | "underweight" | "overweight" {
  const tol = expectedKg * (tolerancePct / 100);
  if (grossKg < expectedKg - tol) return "underweight";
  if (grossKg > expectedKg + tol) return "overweight";
  return "ok";
}
