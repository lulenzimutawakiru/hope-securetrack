import type { OeeInput, OeeResult } from "./types";

/**
 * OEE = Availability × Performance × Quality
 *
 * Availability = Run Time / Planned Production Time
 * Performance  = (Ideal Cycle × Total Count) / Run Time
 * Quality      = Good Count / Total Count
 */
export function calculateOee(input: OeeInput): OeeResult {
  const planned = Math.max(0, Number(input.plannedMinutes) || 0);
  const downtime = Math.max(0, Number(input.downtimeMinutes) || 0);
  let run = Number(input.runMinutes);
  if (!Number.isFinite(run) || run < 0) {
    run = Math.max(0, planned - downtime);
  }

  const good = Math.max(0, Number(input.goodQty) || 0);
  const scrap = Math.max(0, Number(input.scrapQty) || 0);
  const total = good + scrap;
  const idealCycleSec = Math.max(0.001, Number(input.idealCycleSec) || 60);

  const availability = planned > 0 ? Math.min(100, (run / planned) * 100) : 0;

  // Performance: ideal time for total count vs actual run time
  const idealMinutes = (total * idealCycleSec) / 60;
  const performance =
    run > 0 && total > 0 ? Math.min(100, (idealMinutes / run) * 100) : total === 0 ? 0 : 100;

  const quality = total > 0 ? (good / total) * 100 : 0;

  const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;

  return {
    availability: round2(availability),
    performance: round2(performance),
    quality: round2(quality),
    oee: round2(oee),
  };
}

export function oeeGrade(oee: number): { label: string; tone: "excellent" | "good" | "fair" | "poor" } {
  if (oee >= 85) return { label: "World Class", tone: "excellent" };
  if (oee >= 70) return { label: "Good", tone: "good" };
  if (oee >= 50) return { label: "Fair", tone: "fair" };
  return { label: "Needs Improvement", tone: "poor" };
}

export function lossAnalysis(input: OeeInput): {
  availabilityLossMin: number;
  performanceLossMin: number;
  qualityLossUnits: number;
} {
  const planned = Math.max(0, input.plannedMinutes);
  const run = Math.max(0, input.runMinutes || planned - input.downtimeMinutes);
  const good = Math.max(0, input.goodQty);
  const scrap = Math.max(0, input.scrapQty);
  const total = good + scrap;
  const idealCycleSec = Math.max(0.001, input.idealCycleSec || 60);
  const idealMinutes = (total * idealCycleSec) / 60;

  return {
    availabilityLossMin: Math.max(0, planned - run),
    performanceLossMin: Math.max(0, run - idealMinutes),
    qualityLossUnits: scrap,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
