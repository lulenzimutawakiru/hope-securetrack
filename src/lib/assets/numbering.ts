/** Intelligent asset tag numbering */

import type { TagNumberParts } from "./types";

/** Luhn-like check digit for asset tags */
export function checkDigit(numericPart: string): string {
  const digits = numericPart.replace(/\D/g, "");
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return String((10 - (sum % 10)) % 10);
}

export function formatAssetTag(parts: TagNumberParts): string {
  const pad = parts.padWidth ?? 6;
  const seq = String(parts.sequence).padStart(pad, "0");
  const base = `${parts.companyPrefix}-${parts.domain.toUpperCase()}-${parts.typeCode.toUpperCase()}-${seq}`;
  if (parts.checkDigit) {
    return `${base}-${checkDigit(seq)}`;
  }
  return base;
}

export function parseAssetTag(tag: string): {
  prefix?: string;
  domain?: string;
  typeCode?: string;
  sequence?: string;
} {
  const parts = tag.split("-");
  if (parts.length < 4) return {};
  return {
    prefix: parts[0],
    domain: parts[1],
    typeCode: parts[2],
    sequence: parts[3],
  };
}

export function sequenceKey(domain: string, typeCode: string): string {
  return `${domain.toUpperCase()}-${typeCode.toUpperCase()}`;
}
