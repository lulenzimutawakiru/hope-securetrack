/** Multi-country PAYE / NSSF calculators */

import type { PayeBracket } from "./types";

/** Default Uganda monthly PAYE brackets (illustrative — configure in DB) */
export const UG_PAYE_BRACKETS: PayeBracket[] = [
  { min_amount: 0, max_amount: 235000, rate_pct: 0, fixed_amount: 0 },
  { min_amount: 235000, max_amount: 335000, rate_pct: 10, fixed_amount: 0 },
  { min_amount: 335000, max_amount: 410000, rate_pct: 20, fixed_amount: 10000 },
  { min_amount: 410000, max_amount: 10000000, rate_pct: 30, fixed_amount: 25000 },
  { min_amount: 10000000, max_amount: null, rate_pct: 40, fixed_amount: 2920000 },
];

export const KE_PAYE_BRACKETS: PayeBracket[] = [
  { min_amount: 0, max_amount: 24000, rate_pct: 10, fixed_amount: 0 },
  { min_amount: 24000, max_amount: 32333, rate_pct: 25, fixed_amount: 2400 },
  { min_amount: 32333, max_amount: null, rate_pct: 30, fixed_amount: 4483.25 },
];

export function defaultBrackets(country: string): PayeBracket[] {
  if (country === "KE") return KE_PAYE_BRACKETS;
  return UG_PAYE_BRACKETS;
}

/**
 * Progressive PAYE using bracket table.
 * For brackets with fixed_amount representing cumulative tax at min, use fixed + excess * rate.
 */
export function calculatePaye(
  taxableIncome: number,
  brackets: PayeBracket[] = UG_PAYE_BRACKETS
): number {
  if (taxableIncome <= 0) return 0;
  const sorted = [...brackets].sort((a, b) => a.min_amount - b.min_amount);

  for (let i = sorted.length - 1; i >= 0; i--) {
    const b = sorted[i];
    if (taxableIncome > b.min_amount) {
      const excess = taxableIncome - b.min_amount;
      return Math.round(b.fixed_amount + (excess * b.rate_pct) / 100);
    }
  }
  return 0;
}

export function calculateNssfEmployee(gross: number, ratePct = 5, cap?: number | null): number {
  const base = cap && gross > cap ? cap : gross;
  return Math.round((base * ratePct) / 100);
}

export function calculateNssfEmployer(gross: number, ratePct = 10, cap?: number | null): number {
  const base = cap && gross > cap ? cap : gross;
  return Math.round((base * ratePct) / 100);
}

/** Kenya NHIF simplified bands (illustrative) */
export function calculateNhif(gross: number): number {
  if (gross <= 5999) return 150;
  if (gross <= 7999) return 300;
  if (gross <= 11999) return 400;
  if (gross <= 14999) return 500;
  if (gross <= 19999) return 600;
  if (gross <= 24999) return 750;
  if (gross <= 29999) return 850;
  if (gross <= 34999) return 900;
  if (gross <= 39999) return 950;
  if (gross <= 44999) return 1000;
  if (gross <= 49999) return 1100;
  if (gross <= 59999) return 1200;
  if (gross <= 69999) return 1300;
  if (gross <= 79999) return 1400;
  if (gross <= 89999) return 1500;
  if (gross <= 99999) return 1600;
  return 1700;
}

export function statutoryForCountry(country: string, gross: number, taxable: number) {
  if (country === "KE") {
    const nssf_employee = calculateNssfEmployee(gross, 6);
    const nssf_employer = calculateNssfEmployer(gross, 6);
    const nhif = calculateNhif(gross);
    const paye = calculatePaye(Math.max(0, taxable - nssf_employee), KE_PAYE_BRACKETS);
    return { paye, nssf_employee, nssf_employer, lst: 0, nhif, other_statutory: nhif };
  }
  // Uganda default
  const nssf_employee = calculateNssfEmployee(gross, 5);
  const nssf_employer = calculateNssfEmployer(gross, 10);
  const paye = calculatePaye(Math.max(0, taxable - nssf_employee), UG_PAYE_BRACKETS);
  return { paye, nssf_employee, nssf_employer, lst: 0, nhif: 0, other_statutory: 0 };
}
