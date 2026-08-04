"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Printer, Bluetooth, Layers, LayoutTemplate, ListOrdered, Shield,
  FileText, Package, Wrench, BarChart3, Wand2, ArrowRight, Tag, Radio,
  Server, Zap, IdCard, Warehouse, Gauge, Droplets, FileLock2, KeyRound,
  Smartphone,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { PRINT_LIFECYCLE } from "@/lib/print";

const MODULES = [
  { title: "Printer Registry", href: "/dashboard/print/registry", icon: Printer, desc: "All devices · brands · status" },
  { title: "Print Server", href: "/dashboard/print/server", icon: Server, desc: "Load balance · schedules" },
  { title: "Print Queue", href: "/dashboard/print/queue", icon: ListOrdered, desc: "Jobs · priority · reprint" },
  { title: "Secure Release", href: "/dashboard/print/release", icon: KeyRound, desc: "PIN unlock confidential" },
  { title: "Automation", href: "/dashboard/print/automation", icon: Zap, desc: "ERP event triggers" },
  { title: "Label Designer", href: "/dashboard/print/designer", icon: LayoutTemplate, desc: "Drag layout · variables" },
  { title: "Templates", href: "/dashboard/print/templates", icon: Layers, desc: "QR · ship · ID · docs" },
  { title: "Product Labels", href: "/dashboard/print/product-labels", icon: Tag, desc: "Mfg · serial · QR auth" },
  { title: "Inventory Labels", href: "/dashboard/print/inventory-labels", icon: Warehouse, desc: "Shelf · bin · pallet" },
  { title: "ID Cards", href: "/dashboard/print/id-cards", icon: IdCard, desc: "Staff · visitor · RFID" },
  { title: "Niimbot Hub", href: "/dashboard/print/niimbot", icon: Bluetooth, desc: "BLE pair · 50×30 labels" },
  { title: "QR & Barcodes", href: "/dashboard/print/codes", icon: Tag, desc: "QR · Code128 · EAN · DM" },
  { title: "Security Print", href: "/dashboard/print/security", icon: Shield, desc: "Watermark · microtext · holo" },
  { title: "Secure PDF", href: "/dashboard/print/secure-pdf", icon: FileLock2, desc: "Anti-copy · SIG hash" },
  { title: "Documents", href: "/dashboard/print/documents", icon: FileText, desc: "Invoice · PO · GRN profiles" },
  { title: "Batch Print", href: "/dashboard/print/batches", icon: Package, desc: "High-volume bulk" },
  { title: "Media Stock", href: "/dashboard/print/media", icon: Radio, desc: "Label sizes · reorder" },
  { title: "Consumables", href: "/dashboard/print/consumables", icon: Droplets, desc: "Toner · ribbon · alerts" },
  { title: "Quotas & Access", href: "/dashboard/print/quotas", icon: Gauge, desc: "Dept limits · RBAC" },
  { title: "Service History", href: "/dashboard/print/service", icon: Wrench, desc: "Maintenance · warranty" },
  { title: "Mobile / Remote", href: "/dashboard/print/mobile", icon: Smartphone, desc: "BLE · branch · PIN" },
  { title: "Analytics", href: "/dashboard/print/analytics", icon: BarChart3, desc: "Volume · cost · utilization" },
  { title: "AI Assistant", href: "/dashboard/print/ai", icon: Wand2, desc: "Routing · forecast · health" },
  { title: "Legacy Labels", href: "/dashboard/labels", icon: Tag, desc: "Batch QR label sheet" },
  { title: "Legacy Jobs", href: "/dashboard/printing", icon: ListOrdered, desc: "Production print jobs" },
];

export default function PrintHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    printers: 0,
    online: 0,
    queued: 0,
    failed: 0,
    templates: 0,
    media: 0,
  });
  const [defaults, setDefaults] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [printers, online, queued, failed, templates, media, { data: defs }] =
        await Promise.all([
          sb.from("printers").select("*", { count: "exact", head: true }).eq("is_active", true),
          sb.from("printers").select("*", { count: "exact", head: true }).eq("status", "online"),
          sb.from("prt_queue").select("*", { count: "exact", head: true }).eq("status", "queued"),
          sb.from("prt_queue").select("*", { count: "exact", head: true }).eq("status", "failed"),
          sb.from("prt_templates").select("*", { count: "exact", head: true }).is("deleted_at", null),
          sb.from("prt_media").select("*", { count: "exact", head: true }).eq("is_active", true),
          sb.from("printers").select("name,model,brand,status,is_default").eq("is_active", true).order("is_default", { ascending: false }).limit(4),
        ]);
      setStats({
        printers: printers.count ?? 0,
        online: online.count ?? 0,
        queued: queued.count ?? 0,
        failed: failed.count ?? 0,
        templates: templates.count ?? 0,
        media: media.count ?? 0,
      });
      setDefaults((defs as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading print platform…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Print Platform"
        description="Printers · labels · QR · security · queue · Niimbot · industrial"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/printers">Classic printers</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/print/queue">Open queue</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {PRINT_LIFECYCLE.map((s) => (
          <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
        ))}
      </div>

      {defaults.length > 0 && (
        <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="pt-4 flex flex-wrap gap-4">
            {defaults.map((p) => (
              <div key={String(p.name)} className="min-w-[140px]">
                <p className="text-xs text-muted-foreground">
                  {Boolean(p.is_default) ? "Default" : String(p.brand || "Printer")}
                </p>
                <p className="font-medium text-sm">{String(p.name)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {String(p.model)} · {String(p.status)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard title="Active printers" value={String(stats.printers)} icon={Printer} />
        <StatCard title="Online" value={String(stats.online)} icon={Radio} />
        <StatCard title="Queued jobs" value={String(stats.queued)} icon={ListOrdered} />
        <StatCard title="Failed" value={String(stats.failed)} icon={ListOrdered} />
        <StatCard title="Templates" value={String(stats.templates)} icon={Layers} />
        <StatCard title="Media SKUs" value={String(stats.media)} icon={Package} />
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
