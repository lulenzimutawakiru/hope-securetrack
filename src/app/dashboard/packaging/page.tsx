"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package, Boxes, Ruler, ClipboardList, Factory, ScanLine,
  Layers, Scale, ShieldCheck, FileText, BarChart3, Wand2,
  ArrowRight, Smartphone, Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { PKG_LIFECYCLE } from "@/lib/packaging";

const MODULES = [
  { title: "Materials", href: "/dashboard/packaging/materials", icon: Boxes, desc: "Cartons · wrap · seals · stock" },
  { title: "Pack Rules", href: "/dashboard/packaging/rules", icon: Ruler, desc: "Units · carton · pallet config" },
  { title: "Cartonization", href: "/dashboard/packaging/cartonization", icon: Package, desc: "Best carton · space plan" },
  { title: "Work Orders", href: "/dashboard/packaging/work-orders", icon: ClipboardList, desc: "From production & sales" },
  { title: "Packing Lines", href: "/dashboard/packaging/lines", icon: Factory, desc: "Capacity · efficiency" },
  { title: "Packing Floor", href: "/dashboard/packaging/floor", icon: ScanLine, desc: "Scan reams · build cartons" },
  { title: "Pallets", href: "/dashboard/packaging/pallets", icon: Layers, desc: "Stack cartons · master QR" },
  { title: "Weighing", href: "/dashboard/packaging/weighing", icon: Scale, desc: "Net · gross · dimensions" },
  { title: "QC Checks", href: "/dashboard/packaging/qc", icon: ShieldCheck, desc: "Label · QR · seal · weight" },
  { title: "Packing Lists", href: "/dashboard/packaging/packing-lists", icon: FileText, desc: "PDF · customer docs" },
  { title: "QR Hierarchy", href: "/dashboard/packaging/hierarchy", icon: Warehouse, desc: "Pallet → carton → ream" },
  { title: "Mobile Floor", href: "/dashboard/packaging/mobile", icon: Smartphone, desc: "Operators · scanners" },
  { title: "Analytics", href: "/dashboard/packaging/analytics", icon: BarChart3, desc: "Throughput · cost · waste" },
  { title: "AI Assistant", href: "/dashboard/packaging/ai", icon: Wand2, desc: "Optimize · forecast" },
  { title: "Legacy Pack", href: "/dashboard/packing", icon: Package, desc: "5-ream carton scan" },
];

export default function PackagingHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    materials: 0,
    openWo: 0,
    lines: 0,
    cartons: 0,
    pallets: 0,
    lowMat: 0,
  });

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [materials, openWo, lines, cartons, pallets, { data: mats }] = await Promise.all([
        sb.from("pkg_materials").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("pkg_work_orders").select("*", { count: "exact", head: true }).in("status", ["released", "in_progress", "qc"]),
        sb.from("pkg_lines").select("*", { count: "exact", head: true }).eq("is_active", true),
        sb.from("cartons").select("*", { count: "exact", head: true }),
        sb.from("pkg_pallets").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("pkg_materials").select("stock_qty,reorder_level").is("deleted_at", null),
      ]);
      const lowMat = (mats || []).filter((m) => Number(m.stock_qty) <= Number(m.reorder_level)).length;
      setStats({
        materials: materials.count ?? 0,
        openWo: openWo.count ?? 0,
        lines: lines.count ?? 0,
        cartons: cartons.count ?? 0,
        pallets: pallets.count ?? 0,
        lowMat,
      });
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading packaging platform…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Packaging & Packing"
        description="Cartonization · lines · QR hierarchy · pallets · QC · packing lists"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/packing">Legacy packing</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/packaging/floor">Packing floor</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {PKG_LIFECYCLE.map((s) => (
          <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
        ))}
      </div>

      <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-4 text-sm">
          <strong>Hope Paper standard:</strong> 1 ream → wrap + QR · 5 reams → carton + master QR · 40 cartons → pallet master QR.
          Full authenticity chain from ream to dispatch.
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard title="Materials" value={String(stats.materials)} icon={Boxes} />
        <StatCard title="Open work orders" value={String(stats.openWo)} icon={ClipboardList} />
        <StatCard title="Packing lines" value={String(stats.lines)} icon={Factory} />
        <StatCard title="Cartons" value={String(stats.cartons)} icon={Package} />
        <StatCard title="Pallets" value={String(stats.pallets)} icon={Layers} />
        <StatCard title="Low materials" value={String(stats.lowMat)} icon={Boxes} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group flex items-center gap-3 rounded-lg border p-4 hover:border-primary/40 hover:bg-muted/40 transition"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <m.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm group-hover:text-primary">{m.title}</p>
              <p className="text-xs text-muted-foreground truncate">{m.desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  );
}
