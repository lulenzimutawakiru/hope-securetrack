import { mustList, persistInsights, type RuleInsight } from "@/lib/crud/ai-insights";

export type LblInsight = RuleInsight;

export async function generateLabelInsights(
  companyId: string
): Promise<LblInsight[]> {
  void companyId;
  const insights: LblInsight[] = [];

  const [materials, stock, jobs, reprints, batches] = await Promise.all([
    mustList<Record<string, unknown>>("lbl_materials", { pageSize: 100 }),
    mustList<Record<string, unknown>>("lbl_stock", { pageSize: 100 }),
    mustList<Record<string, unknown>>("lbl_jobs", { pageSize: 100 }),
    mustList<Record<string, unknown>>("lbl_reprints", { pageSize: 100 }),
    mustList<Record<string, unknown>>("lbl_batches", { pageSize: 100 }),
  ]);

  const lowMat = materials.filter(
    (m) => Number(m.roll_qty || 0) <= Number(m.reorder_level || 0)
  );
  if (lowMat.length > 0) {
    insights.push({
      insight_type: "stock",
      title: "Label media at reorder point",
      summary: `${lowMat.length} material(s) at or below reorder level.`,
      severity: "high",
      score: 80,
      recommendations: [
        "Create purchase request",
        "Switch to alternate stock location",
      ],
      status: "open",
    });
  }

  const failed = jobs.filter((j) => j.status === "failed");
  if (failed.length > 0) {
    insights.push({
      insight_type: "print",
      title: "Failed label jobs",
      summary: `${failed.length} print job(s) failed — check printer connectivity and media.`,
      severity: "high",
      score: 75,
      recommendations: [
        "Retry on Niimbot/Zebra profile",
        "Inspect darkness/speed settings",
      ],
      status: "open",
    });
  }

  const pendingRp = reprints.filter((r) => r.status === "pending");
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

  const openBatches = batches.filter((b) =>
    ["ready", "printing", "paused"].includes(String(b.status))
  );
  if (openBatches.length >= 2) {
    insights.push({
      insight_type: "production",
      title: "Open label batches",
      summary: `${openBatches.length} batches still in production pipeline.`,
      severity: "low",
      score: 50,
      recommendations: ["Balance printer queues"],
      status: "open",
    });
  }

  void stock;
  await persistInsights("lbl_ai_insights", insights);
  return insights;
}
