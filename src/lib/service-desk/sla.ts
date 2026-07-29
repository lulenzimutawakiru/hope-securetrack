import { PRIORITIES, type SlaResult, type TicketPriority } from "./types";

export function computePriorityFromImpactUrgency(
  impact: string,
  urgency: string
): TicketPriority {
  const rank = (v: string) =>
    ({ critical: 4, high: 3, medium: 2, low: 1 }[v] ?? 2);
  const score = rank(impact) + rank(urgency);
  if (score >= 7) return "critical";
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

export function slaMinutesForPriority(priority: string): {
  responseMinutes: number;
  resolveMinutes: number;
} {
  const p = PRIORITIES.find((x) => x.value === priority);
  return {
    responseMinutes: p?.responseMin ?? 60,
    resolveMinutes: p?.resolveMin ?? 480,
  };
}

export function calculateSlaDue(
  priority: string,
  from: Date = new Date(),
  overrides?: { responseMinutes?: number; resolveMinutes?: number }
): SlaResult {
  const base = slaMinutesForPriority(priority);
  const responseMinutes = overrides?.responseMinutes ?? base.responseMinutes;
  const resolveMinutes = overrides?.resolveMinutes ?? base.resolveMinutes;
  return {
    responseDue: new Date(from.getTime() + responseMinutes * 60_000),
    resolveDue: new Date(from.getTime() + resolveMinutes * 60_000),
    responseMinutes,
    resolveMinutes,
  };
}

export function slaStatus(params: {
  due: string | Date | null | undefined;
  met?: boolean | null;
  completedAt?: string | Date | null;
}): "met" | "breached" | "at_risk" | "on_track" | "n/a" {
  if (params.met === true) return "met";
  if (params.met === false) return "breached";
  if (!params.due) return "n/a";
  const due = new Date(params.due).getTime();
  const now = Date.now();
  if (params.completedAt) {
    return new Date(params.completedAt).getTime() <= due ? "met" : "breached";
  }
  if (now > due) return "breached";
  const remaining = due - now;
  if (remaining < 30 * 60_000) return "at_risk";
  return "on_track";
}

export function minutesUntil(due: string | Date | null | undefined): number | null {
  if (!due) return null;
  return Math.round((new Date(due).getTime() - Date.now()) / 60_000);
}
