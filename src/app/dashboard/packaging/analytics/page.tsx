"use client";

import { useEffect, useState } from "react";
import { BarChart3, Package, Layers, ClipboardList, Boxes, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

export default function PkgAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    cartons: 0,
    pallets: 0,
    openWo: 0,
    materials: 0,
    lowMat: 0,
    qcFail: 0,
    qcPass: 0,
    weightIssues: 0,
    matCost: 0,
  });
  const [lines, setLines] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [
        cartons, pallets, openWo, materials,
        { data: mats },
        { count: qcFail },
        { count: qcPass },
        { count: weightIssues },
        { data: issues },
        { data: lineRows },
      ] = await Promise.all([
        sb.from("cartons").select("*", { count: "exact", head: true }),
        sb.from("pkg_pallets").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("pkg_work_orders").select("*", { count: "exact", head: true }).in("status", ["released", "in_progress"]),
        sb.from("pkg_materials").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("pkg_materials").select("stock_qty,reorder_level"),
        sb.from("pkg_qc_checks").select("*", { count: "exact", head: true }).eq("overall_status", "fail"),
        sb.from("pkg_qc_checks").select("*", { count: "exact", head: true }).eq("overall_status", "pass"),
        sb.from("pkg_weights").select("*", { count: "exact", head: true }).neq("status", "ok"),
        sb.from("pkg_material_issues").select("total_cost").limit(500),
        sb.from("pkg_lines").select("name,status,efficiency_pct,capacity_units_hour").eq("is_active", true),
      ]);
      const lowMat = (mats || []).filter((m) => Number(m.stock_qty) <= Number(m.reorder_level)).length;
      const matCost = (issues || []).reduce((s, i) => s + Number(i.total_cost || 0), 0);
      setStats({
        cartons: cartons.count ?? 0,
        pallets: pallets.count ?? 0,
        openWo: openWo.count ?? 0,
        materials: materials.count ?? 0,
        lowMat,
        qcFail: qcFail ?? 0,
        qcPass: qcPass ?? 0,
        weightIssues: weightIssues ?? 0,
        matCost,
      });
      setLines((lineRows as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading packaging analytics…" />;

  const qcTotal = stats.qcPass + stats.qcFail;
  const qrRate = qcTotal ? Math.round((stats.qcPass / qcTotal) * 100) : 100;

  return (
    <div>
      <PageHeader
        title="Packaging Analytics"
        description="Throughput · materials · QC · weight · line efficiency · cost"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Cartons packed" value={String(stats.cartons)} icon={Package} />
        <StatCard title="Pallets built" value={String(stats.pallets)} icon={Layers} />
        <StatCard title="Open WOs" value={String(stats.openWo)} icon={ClipboardList} />
        <StatCard title="Materials" value={String(stats.materials)} icon={Boxes} />
        <StatCard title="Low stock SKUs" value={String(stats.lowMat)} icon={Boxes} />
        <StatCard title="QC pass rate" value={`${qrRate}%`} icon={ShieldCheck} />
        <StatCard title="Weight issues" value={String(stats.weightIssues)} icon={BarChart3} />
        <StatCard title="Material cost (issues)" value={formatNumber(stats.matCost)} icon={BarChart3} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lines</p>
          ) : (
            lines.map((l) => (
              <div key={String(l.name)} className="flex justify-between text-sm border-b pb-1">
                <span>
                  {String(l.name)}{" "}
                  <span className="text-muted-foreground capitalize">({String(l.status)})</span>
                </span>
                <span>
                  {String(l.efficiency_pct)}% · {String(l.capacity_units_hour)} u/h
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
