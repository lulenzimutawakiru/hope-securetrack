import { createClient } from "@/lib/supabase/client";

export type LblInsight = {
  insight_type: string;
  title: string;
  summary: string;
  severity: string;
  score?: number;
  recommendations?: string[];
  status?: string;
};

export async function generateLabelInsights(companyId: string): Promise<LblInsight[]> {
  const sb = createClient();
  const insights: LblInsight[] = [];

  const [
    { data: materials },
    { data: stock },
    { data: jobs },
    { data: reprints },
    { data: batches },
  ] = await Promise.all([
    sb.from("lbl_materials").select("material_code,name,roll_qty,reorder_level,status").eq("company_id", companyId).is("deleted_at", null).limit(100),
    sb.from("lbl_stock").select("material_code,qty_on_hand,status").eq("company_id", companyId).is("deleted_at", null).limit(100),
    sb.from("lbl_jobs").select("status,label_count,is_reprint,error_message").eq("company_id", companyId).is("deleted_at", null).limit(200),
    sb.from("lbl_reprints").select("status,reason").eq("company_id", companyId).is("deleted_at", null).limit(100),
    sb.from("lbl_batches").select("status,quantity,printed_count,failed_count").eq("company_id", companyId).is("deleted_at", null).limit(100),
  ]);

  const lowMat = (materials || []).filter(
    (m) => Number(m.roll_qty || 0) <= Number(m.reorder_level || 0)
  );
  if (lowMat.length > 0) {
    insights.push({
      insight_type: "stock",
      title: "Label media at reorder point",
      summary: `${lowMat.length} material(s) at or below reorder level.`,
      severity: "high",
      score: 80,
      recommendations: ["Create purchase request", "Switch to alternate stock location"],
      status: "open",
    });
  }

  const failed = (jobs || []).filter((j) => j.status === "failed");
  if (failed.length > 0) {
    insights.push({
      insight_type: "print",
      title: "Failed label jobs",
      summary: `${failed.length} print job(s) failed — check printer connectivity and media.`,
      severity: "high",
      score: 75,
      recommendations: ["Retry on Niimbot/Zebra profile", "Inspect darkness/speed settings"],
      status: "open",
    });
  }

  const pendingRp = (reprints || []).filter((r) => r.status === "pending");
  if (pendingRp.length >= 3) {
    insights.push({
      insight_type: "security",
      title: "Reprint backlog",
      summary: `${pendingRp.length} reprint requests await approval.`,
      severity: "medium",
      score: 60,
      recommendations: ["Review void risk", "Require reason codes"],
      status: "open",
    });
  }

  const openBatches = (batches || []).filter((b) =>
    ["ready", "printing", "paused"].includes(String(b.status))
  );
  if (openBatches.length >= 2) {
    insights.push({
      insight_type: "production",
      title: "Open label batches",
      summary: `${openBatches.length} batches still in production pipeline.`,
      severity: "low",
      score: 45,
      recommendations: ["Prioritize high-volume batches", "Balance printers by format"],
      status: "open",
    });
  }

  const lowStockRows = (stock || []).filter((s) => s.status === "low" || Number(s.qty_on_hand || 0) < 50);
  if (lowStockRows.length > 0) {
    insights.push({
      insight_type: "stock",
      title: "Warehouse label stock low",
      summary: `${lowStockRows.length} stock location(s) report low quantities.`,
      severity: "medium",
      score: 65,
      recommendations: ["Transfer from central store", "Update reorder alerts"],
      status: "open",
    });
  }

  if (insights.length === 0) {
    insights.push({
      insight_type: "health",
      title: "Label operations healthy",
      summary: "No critical stock, reprint, or print-failure signals detected.",
      severity: "info",
      score: 90,
      recommendations: ["Keep template versions under change control"],
      status: "open",
    });
  }

  for (const [i, ins] of insights.slice(0, 5).entries()) {
    try {
      await sb.from("lbl_ai_insights").insert({
        company_id: companyId,
        insight_code: `AI-LBL-RT-${Date.now()}-${i}`,
        insight_type: ins.insight_type,
        title: ins.title,
        summary: ins.summary,
        severity: ins.severity,
        score: ins.score ?? 0,
        recommendations: (ins.recommendations || []).join("; "),
        status: "open",
      });
    } catch {
      /* ignore */
    }
  }

  return insights;
}
