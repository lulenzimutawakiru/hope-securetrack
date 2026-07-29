/** AI Financial Intelligence Engine */

export function predictCashShortfall(
  forecasts: Array<{ forecast_date: string; projected_balance: number; net_flow: number }>
): { risk: boolean; message: string; worstDate?: string; worstBalance?: number } {
  if (!forecasts.length) {
    return { risk: false, message: "No cash forecast data available." };
  }
  let worst = forecasts[0];
  for (const f of forecasts) {
    if (Number(f.projected_balance) < Number(worst.projected_balance)) worst = f;
  }
  const bal = Number(worst.projected_balance);
  if (bal < 0) {
    return {
      risk: true,
      message: `Projected negative cash on ${worst.forecast_date}. Arrange facilities or accelerate collections.`,
      worstDate: worst.forecast_date,
      worstBalance: bal,
    };
  }
  if (bal < 200_000_000) {
    return {
      risk: true,
      message: `Liquidity tight on ${worst.forecast_date} (UGX ${bal.toLocaleString()}). Delay non-critical AP.`,
      worstDate: worst.forecast_date,
      worstBalance: bal,
    };
  }
  return { risk: false, message: "Cash forecast healthy across horizon.", worstDate: worst.forecast_date, worstBalance: bal };
}

export function detectDuplicatePayments(
  payments: Array<{ amount?: number; supplier_id?: string; reference?: string; id?: string }>
): string[] {
  const seen = new Map<string, string>();
  const dups: string[] = [];
  for (const p of payments) {
    const key = `${p.supplier_id || ""}|${Number(p.amount || 0)}|${p.reference || ""}`;
    if (seen.has(key)) dups.push(`Possible duplicate: ${p.reference || p.id} matches ${seen.get(key)}`);
    else if (p.reference) seen.set(key, String(p.reference || p.id));
  }
  return dups;
}

export function anomalyExpenseFlags(
  lines: Array<{ description?: string; amount?: number; category?: string }>
): string[] {
  const flags: string[] = [];
  for (const l of lines) {
    const amt = Number(l.amount || 0);
    const d = (l.description || "").toLowerCase();
    if (amt >= 50_000_000) flags.push(`Large expense: ${l.description || "line"} (${amt.toLocaleString()})`);
    if (d.includes("cash") && amt >= 5_000_000) flags.push(`High cash expense: ${l.description}`);
    if (d.includes("entertainment") || d.includes("gift")) flags.push(`Review entertainment/gift: ${l.description}`);
  }
  return flags.slice(0, 8);
}

export function forecastRevenue(history: number[]): { next: number; trend: string } {
  if (!history.length) return { next: 0, trend: "No history" };
  const avg = history.reduce((a, b) => a + b, 0) / history.length;
  const last = history[history.length - 1];
  const prev = history.length > 1 ? history[history.length - 2] : last;
  const growth = prev > 0 ? (last - prev) / prev : 0;
  const next = Math.round(last * (1 + growth * 0.6) * 0.4 + avg * 0.6);
  const trend = growth > 0.05 ? "Upward" : growth < -0.05 ? "Downward" : "Stable";
  return { next, trend };
}

export function collectionPriorities(
  invoices: Array<{ customer?: string; amount?: number; days_overdue?: number; id?: string }>
): Array<{ customer: string; amount: number; priority: string; reason: string }> {
  return invoices
    .map((i) => {
      const days = Number(i.days_overdue || 0);
      const amount = Number(i.amount || 0);
      let priority = "normal";
      let reason = "Within terms";
      if (days >= 90 || amount >= 100_000_000) {
        priority = "critical";
        reason = days >= 90 ? `${days}d overdue` : "High value";
      } else if (days >= 45 || amount >= 50_000_000) {
        priority = "high";
        reason = days >= 45 ? `${days}d overdue` : "Material balance";
      } else if (days >= 15) {
        priority = "medium";
        reason = `${days}d overdue`;
      }
      return { customer: String(i.customer || "Customer"), amount, priority, reason };
    })
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, normal: 3 } as Record<string, number>;
      return (order[a.priority] ?? 9) - (order[b.priority] ?? 9) || b.amount - a.amount;
    })
    .slice(0, 10);
}

export function computePaperCosts(input: {
  total_cost: number;
  sheets?: number;
  reams?: number;
  boxes?: number;
  pallets?: number;
  tons?: number;
  batch_qty?: number;
}): {
  cost_per_sheet: number;
  cost_per_ream: number;
  cost_per_box: number;
  cost_per_pallet: number;
  cost_per_ton: number;
  cost_per_batch: number;
  cost_per_order: number;
} {
  const t = Number(input.total_cost || 0);
  const sheets = Number(input.sheets || 0) || (Number(input.reams || 0) * 500);
  const reams = Number(input.reams || input.batch_qty || 0);
  const boxes = Number(input.boxes || 0) || (reams > 0 ? reams / 5 : 0);
  const pallets = Number(input.pallets || 0) || (boxes > 0 ? boxes / 40 : 0);
  const tons = Number(input.tons || 0) || (reams > 0 ? reams * 0.0025 : 0);

  return {
    cost_per_sheet: sheets > 0 ? Math.round((t / sheets) * 10000) / 10000 : 0,
    cost_per_ream: reams > 0 ? Math.round((t / reams) * 100) / 100 : 0,
    cost_per_box: boxes > 0 ? Math.round((t / boxes) * 100) / 100 : 0,
    cost_per_pallet: pallets > 0 ? Math.round((t / pallets) * 100) / 100 : 0,
    cost_per_ton: tons > 0 ? Math.round((t / tons) * 100) / 100 : 0,
    cost_per_batch: t,
    cost_per_order: t,
  };
}

export function explainFinancials(kpis: {
  revenue?: number;
  gross_profit?: number;
  net_profit?: number;
  cash_position?: number;
  ar_balance?: number;
  ap_balance?: number;
  gross_margin_pct?: number;
}): string {
  const lines = [
    `Revenue MTD: UGX ${Number(kpis.revenue || 0).toLocaleString()}.`,
    `Gross profit ${Number(kpis.gross_profit || 0).toLocaleString()} (${Number(kpis.gross_margin_pct || 0)}% margin).`,
    `Net profit ${Number(kpis.net_profit || 0).toLocaleString()}.`,
    `Cash position ${Number(kpis.cash_position || 0).toLocaleString()}; AR ${Number(kpis.ar_balance || 0).toLocaleString()}; AP ${Number(kpis.ap_balance || 0).toLocaleString()}.`,
  ];
  if (Number(kpis.gross_margin_pct || 0) < 25) {
    lines.push("Margin below 25% — review material yield and pricing on security/bond lines.");
  }
  if (Number(kpis.ar_balance || 0) > Number(kpis.ap_balance || 0) * 1.5) {
    lines.push("AR elevated vs AP — prioritize collections to protect working capital.");
  }
  return lines.join(" ");
}

export function costSavingsIdeas(costRolls: Array<{ product_line?: string; variance_amount?: number; scrap_cost?: number }>): string[] {
  const ideas: string[] = [];
  const totalVar = costRolls.reduce((s, r) => s + Number(r.variance_amount || 0), 0);
  const scrap = costRolls.reduce((s, r) => s + Number(r.scrap_cost || 0), 0);
  if (totalVar > 0) ideas.push("Investigate favorable/unfavorable production variances on security batches.");
  if (scrap > 5_000_000) ideas.push("Scrap cost elevated — tighten QC gates and pulp moisture controls.");
  ideas.push("Negotiate volume rebate on strategic pulp (see SRM).");
  ideas.push("Shift non-urgent freight to dual-carrier dual-award rates.");
  return ideas.slice(0, 5);
}
