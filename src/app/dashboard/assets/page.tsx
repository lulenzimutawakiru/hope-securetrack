"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Tags, ClipboardList, UserCheck, ScanLine, Wrench, Bell,
  BarChart3, Wand2, ArrowRight, Smartphone, Printer, FolderTree,
  Crosshair, QrCode,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { crudCount, crudList } from "@/lib/api/crud-client";
import { ASSET_LIFECYCLE } from "@/lib/assets";
import { formatNumber } from "@/lib/utils";

const MODULES = [
  { title: "Asset Register", href: "/dashboard/assets/register", icon: ClipboardList, desc: "CRUD · tag · QR · RFID · GPS" },
  { title: "Categories", href: "/dashboard/assets/categories", icon: FolderTree, desc: "IT · MFG · fleet · digital" },
  { title: "Assignments", href: "/dashboard/assets/assign", icon: UserCheck, desc: "Employee · dept · project" },
  { title: "Inventory Audits", href: "/dashboard/assets/audits", icon: ScanLine, desc: "QR · barcode · RFID sweep" },
  { title: "Tag Print", href: "/dashboard/assets/tags", icon: Printer, desc: "Label designer · batch print" },
  { title: "Maintenance", href: "/dashboard/assets/maintenance", icon: Wrench, desc: "PM · CM · calibration" },
  { title: "Alerts", href: "/dashboard/assets/alerts", icon: Bell, desc: "Warranty · missing · movement" },
  { title: "Scan / Verify", href: "/dashboard/assets/scan", icon: QrCode, desc: "Camera · NFC · verify token" },
  { title: "Analytics", href: "/dashboard/assets/analytics", icon: BarChart3, desc: "Value · distribution · RUL" },
  { title: "AI Assistant", href: "/dashboard/assets/ai", icon: Wand2, desc: "Predict · utilize · budget" },
  { title: "Mobile Ops", href: "/dashboard/assets/mobile", icon: Smartphone, desc: "Offline scan · field update" },
  { title: "Finance Assets", href: "/dashboard/finance/assets", icon: Tags, desc: "Depreciation · fixed assets" },
];

export default function AssetsHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    assigned: 0,
    missing: 0,
    maintenance: 0,
    openAlerts: 0,
    value: 0,
  });

  useEffect(() => {
    async function load() {
      try {
        const [total, assigned, missing, maint, openAlerts, valsRes] =
          await Promise.all([
            crudCount("ast_assets"),
            crudCount("ast_assets", { status: "assigned" }),
            crudCount("ast_assets", { status: "missing" }),
            crudCount("ast_assets", { status: "maintenance" }),
            crudCount("ast_alerts", { status: "open" }),
            crudList<Record<string, unknown>>("ast_assets", {
              page: 1,
              pageSize: 100,
            }),
          ]);
        const vals = valsRes.ok ? valsRes.data.data : [];
        // Walk more pages for value if needed (bounded)
        let value = vals.reduce(
          (s, r) => s + Number(r.current_value || 0),
          0
        );
        if (valsRes.ok && valsRes.data.total > 100) {
          const page2 = await crudList<Record<string, unknown>>("ast_assets", {
            page: 2,
            pageSize: 100,
          });
          if (page2.ok) {
            value += page2.data.data.reduce(
              (s, r) => s + Number(r.current_value || 0),
              0
            );
          }
        }
        setStats({
          total,
          assigned,
          missing,
          maintenance: maint,
          openAlerts,
          value,
        });
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading asset identification platform…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Asset Tagging"
        description="Digital identity · QR · barcode · RFID · NFC · GPS · lifecycle · digital twin"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/assets/scan">Scan</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/assets/register">Register asset</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {ASSET_LIFECYCLE.map((s) => (
          <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
        ))}
      </div>

      <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-4 text-sm flex items-start gap-3">
          <Crosshair className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <strong>Intelligent tags:</strong>{" "}
            <code className="text-xs bg-muted px-1 rounded">HDG-IT-LAP-000001</code>
            {" · "}
            multi-ID (QR/barcode/RFID/NFC/GPS/BLE) · signed verification · audit trail · digital twin.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard title="Total assets" value={String(stats.total)} icon={Tags} />
        <StatCard title="Assigned" value={String(stats.assigned)} icon={UserCheck} />
        <StatCard title="Missing" value={String(stats.missing)} icon={ScanLine} />
        <StatCard title="In maintenance" value={String(stats.maintenance)} icon={Wrench} />
        <StatCard title="Open alerts" value={String(stats.openAlerts)} icon={Bell} />
        <StatCard title="Portfolio value" value={formatNumber(stats.value)} icon={BarChart3} />
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
