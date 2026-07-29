/** AI Procurement Intelligence Engine */

export interface ScorecardFactors {
  on_time_delivery?: number;
  delivery_accuracy?: number;
  product_quality?: number;
  defect_rate?: number;
  cost_competitiveness?: number;
  invoice_accuracy?: number;
  response_time?: number;
  contract_compliance?: number;
  sustainability?: number;
}

export function computeOverallScore(f: ScorecardFactors): { overall: number; grade: string } {
  const weights = {
    on_time_delivery: 0.18,
    delivery_accuracy: 0.12,
    product_quality: 0.2,
    defect_rate: 0.1,
    cost_competitiveness: 0.12,
    invoice_accuracy: 0.08,
    response_time: 0.08,
    contract_compliance: 0.07,
    sustainability: 0.05,
  };

  // defect_rate is inverted (lower is better)
  const defectScore = Math.max(0, 100 - Number(f.defect_rate || 0) * 10);

  const overall =
    Number(f.on_time_delivery || 0) * weights.on_time_delivery +
    Number(f.delivery_accuracy || 0) * weights.delivery_accuracy +
    Number(f.product_quality || 0) * weights.product_quality +
    defectScore * weights.defect_rate +
    Number(f.cost_competitiveness || 0) * weights.cost_competitiveness +
    Number(f.invoice_accuracy || 0) * weights.invoice_accuracy +
    Number(f.response_time || 0) * weights.response_time +
    Number(f.contract_compliance || 0) * weights.contract_compliance +
    Number(f.sustainability || 0) * weights.sustainability;

  const score = Math.round(overall * 10) / 10;
  let grade = "D";
  if (score >= 90) grade = "A";
  else if (score >= 80) grade = "B";
  else if (score >= 70) grade = "C";
  else if (score >= 60) grade = "D";
  else grade = "F";

  return { overall: score, grade };
}

export function predictDisruptionRisk(input: {
  on_time_delivery?: number;
  supply_risk?: number;
  country_risk?: number;
  financial_risk?: number;
  open_ncrs?: number;
}): number {
  let risk = 20;
  const otd = Number(input.on_time_delivery ?? 95);
  if (otd < 80) risk += 25;
  else if (otd < 90) risk += 12;
  risk += Number(input.supply_risk || 0) * 0.25;
  risk += Number(input.country_risk || 0) * 0.15;
  risk += Number(input.financial_risk || 0) * 0.2;
  risk += Math.min(20, (input.open_ncrs || 0) * 5);
  return Math.max(0, Math.min(100, Math.round(risk)));
}

export function recommendSuppliers(
  suppliers: Array<{
    name?: string;
    category?: string | null;
    overall_score?: number | null;
    risk_score?: number | null;
    supplier_class?: string | null;
    is_approved_vendor?: boolean | null;
  }>,
  category?: string
): Array<{ name: string; reason: string; score: number }> {
  return suppliers
    .filter((s) => !category || String(s.category || "").includes(category) || !category)
    .filter((s) => s.is_approved_vendor !== false)
    .map((s) => {
      const perf = Number(s.overall_score || 70);
      const risk = Number(s.risk_score || 50);
      const score = Math.round(perf * 0.7 + (100 - risk) * 0.3);
      let reason = `Score ${perf}, risk ${risk}`;
      if (String(s.supplier_class) === "strategic") reason += " · strategic partner";
      if (perf >= 90) reason += " · top performer";
      return { name: String(s.name || "Supplier"), reason, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function detectPriceAnomaly(
  unitPrice: number,
  historicalAvg: number
): { abnormal: boolean; variance_pct: number; message: string } {
  if (!historicalAvg || historicalAvg <= 0) {
    return { abnormal: false, variance_pct: 0, message: "Insufficient price history." };
  }
  const variance_pct = Math.round(((unitPrice - historicalAvg) / historicalAvg) * 1000) / 10;
  const abnormal = Math.abs(variance_pct) >= 15;
  return {
    abnormal,
    variance_pct,
    message: abnormal
      ? `Price ${variance_pct > 0 ? "above" : "below"} historical average by ${Math.abs(variance_pct)}%. Review negotiation.`
      : `Price within normal band (${variance_pct}%).`,
  };
}

export function negotiationOpportunities(spendYtd: number, overallScore: number): string[] {
  const tips: string[] = [];
  if (spendYtd >= 100_000_000 && overallScore >= 85) {
    tips.push("Qualify for volume rebate / early-payment discount discussion.");
  }
  if (overallScore < 75) {
    tips.push("Performance below target — link renewal to improvement plan.");
  }
  if (spendYtd >= 50_000_000) {
    tips.push("Consider multi-year framework with price-lock clauses.");
  }
  tips.push("Request open-book cost breakdown on top 3 SKUs.");
  return tips.slice(0, 4);
}

export function contractRiskHints(endDate?: string | null, spendToDate?: number, valueLimit?: number): string[] {
  const hints: string[] = [];
  if (endDate) {
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) hints.push("Contract expired — initiate renewal or stop-work.");
    else if (days <= 60) hints.push(`Contract expires in ${days} days — start renewal workflow.`);
  }
  if (valueLimit && spendToDate != null && valueLimit > 0) {
    const util = (spendToDate / valueLimit) * 100;
    if (util >= 90) hints.push(`Spend at ${Math.round(util)}% of contract limit.`);
    else if (util >= 75) hints.push(`Spend approaching limit (${Math.round(util)}%).`);
  }
  return hints;
}

export function qualityRecurringIssues(
  ncrs: Array<{ defect_type?: string | null; supplier_id?: string | null }>
): string {
  if (!ncrs.length) return "No open NCRs — quality stable.";
  const counts = new Map<string, number>();
  for (const n of ncrs) {
    const k = n.defect_type || "unspecified";
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) {
    return `AI: Recurring defect type "${top[0]}" (${top[1]} NCRs). Escalate CAPA and consider source inspection.`;
  }
  return `${ncrs.length} open NCR(s). Monitor CAPA due dates.`;
}

export function spendForecast(
  monthlySpend: number[],
  monthsAhead = 3
): { projected: number; trend: string } {
  if (!monthlySpend.length) return { projected: 0, trend: "No spend history" };
  const avg = monthlySpend.reduce((a, b) => a + b, 0) / monthlySpend.length;
  const last = monthlySpend[monthlySpend.length - 1];
  const prev = monthlySpend.length > 1 ? monthlySpend[monthlySpend.length - 2] : last;
  const growth = prev > 0 ? (last - prev) / prev : 0;
  const projected = Math.round(avg * monthsAhead * (1 + growth * 0.5));
  const trend =
    growth > 0.05 ? "Increasing spend trend" : growth < -0.05 ? "Decreasing spend trend" : "Stable spend";
  return { projected, trend };
}
