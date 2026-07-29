"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Tag,
  Layers,
  Package,
  Printer,
  Ruler,
  Barcode,
  Shield,
  Ship,
  Warehouse,
  Brain,
  ArrowRight,
  AlertTriangle,
  Bluetooth,
  FileStack,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { LBL_MENU, getLabelsDashboardStats } from "@/lib/lbl";
import { createClient } from "@/lib/supabase/client";

const QUICK = [
  { title: "Auth QR Sheet", href: "/dashboard/labels/auth-sheet", icon: Tag, desc: "Batch verification labels" },
  { title: "Templates", href: "/dashboard/labels/templates", icon: Layers, desc: "Design templates" },
  { title: "Formats", href: "/dashboard/labels/formats", icon: Ruler, desc: "Sizes & DPI" },
  { title: "Batches", href: "/dashboard/labels/batches", icon: Package, desc: "High-volume runs" },
  { title: "Print Jobs", href: "/dashboard/labels/jobs", icon: Printer, desc: "Live queue" },
  { title: "Barcodes", href: "/dashboard/labels/barcodes", icon: Barcode, desc: "QR · Code128 · EAN" },
  { title: "Shipping", href: "/dashboard/labels/shipping", icon: Ship, desc: "Carrier labels" },
  { title: "Shelf / Bin", href: "/dashboard/labels/shelf", icon: Warehouse, desc: "Location labels" },
  { title: "Materials", href: "/dashboard/labels/materials", icon: FileStack, desc: "Media catalog" },
  { title: "Security", href: "/dashboard/labels/security", icon: Shield, desc: "Anti-counterfeit" },
  { title: "Niimbot", href: "/dashboard/print/niimbot", icon: Bluetooth, desc: "BLE thermal" },
  { title: "AI Assistant", href: "/dashboard/labels/ai", icon: Brain, desc: "Stock & quality" },
];

export default function AdvancedLabelsHubPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getLabelsDashboardStats>> | null>(null);
  const [recentBatches, setRecentBatches] = useState<Array<Record<string, unknown>>>([]);
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([]);

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      try {
        const sb = createClient();
        const [s, { data: batches }, { data: ai }] = await Promise.all([
          getLabelsDashboardStats(companyId),
          sb
            .from("lbl_batches")
            .select("id,batch_code,name,label_type,quantity,printed_count,status")
            .eq("company_id", companyId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(8),
          sb
            .from("lbl_ai_insights")
            .select("title,severity,summary,score")
            .eq("company_id", companyId)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);
        setStats(s);
        setRecentBatches((batches as Array<Record<string, unknown>>) || []);
        setInsights((ai as Array<Record<string, unknown>>) || []);
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  const menu = useMemo(() => {
    const s = q.trim().toLowerCase();
    return LBL_MENU.filter(
      (m) => !s || m.title.toLowerCase().includes(s) || m.group.toLowerCase().includes(s)
    );
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, (typeof LBL_MENU)[number][]>();
    for (const m of menu) {
      const list = map.get(m.group) || [];
      list.push(m);
      map.set(m.group, list);
    }
    return map;
  }, [menu]);

  if (loading) return <LoadingState message="Loading Advanced Labels Platform…" />;

  return (
    <div>
      <PageHeader
        title="Advanced Labels"
        description="Templates · Formats · Barcodes · GS1 · Batches · Shipping · Shelf · Security · Niimbot · AI"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/labels/auth-sheet">
                <Tag className="h-4 w-4 mr-1" /> Auth Sheet
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/labels/ai">
                <Brain className="h-4 w-4 mr-1" /> AI
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/labels/batches">
                <Package className="h-4 w-4 mr-1" /> Batches
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 mb-6">
        <StatCard title="Templates" value={String(stats?.templates ?? 0)} icon={Layers} />
        <StatCard title="Formats" value={String(stats?.formats ?? 0)} icon={Ruler} />
        <StatCard title="Materials" value={String(stats?.materials ?? 0)} icon={FileStack} />
        <StatCard title="Low Stock" value={String(stats?.lowStock ?? 0)} icon={AlertTriangle} />
        <StatCard title="Open Batches" value={String(stats?.openBatches ?? 0)} icon={Package} />
        <StatCard title="Labels Ready" value={String(stats?.labelsReady ?? 0)} icon={Tag} />
        <StatCard title="Printed" value={String(stats?.labelsPrinted ?? 0)} icon={Printer} />
        <StatCard title="Queued Jobs" value={String(stats?.queuedJobs ?? 0)} icon={Printer} />
        <StatCard title="Failed Jobs" value={String(stats?.failedJobs ?? 0)} icon={AlertTriangle} />
        <StatCard title="Pending Reprints" value={String(stats?.pendingReprints ?? 0)} icon={Shield} />
        <StatCard title="Shipping Ready" value={String(stats?.shippingReady ?? 0)} icon={Ship} />
        <StatCard title="Pallet Ready" value={String(stats?.palletReady ?? 0)} icon={Package} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
        {QUICK.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="h-full hover:border-primary/50 transition-colors">
              <CardContent className="pt-4 flex gap-3 items-start">
                <m.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-sm">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{m.desc}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Batches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No label batches yet.</p>
            ) : (
              recentBatches.map((b) => (
                <div
                  key={String(b.id)}
                  className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                >
                  <div>
                    <div className="font-medium">{String(b.batch_code)}</div>
                    <div className="text-xs text-muted-foreground">
                      {String(b.name)} · {String(b.label_type)}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{String(b.status)}</Badge>
                    <div className="text-xs mt-1">
                      {String(b.printed_count ?? 0)}/{String(b.quantity ?? 0)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">AI Insights</CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/dashboard/labels/ai">Open</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No stored insights. Open the AI assistant to generate them.
              </p>
            ) : (
              insights.map((ins, i) => (
                <div key={i} className="border-b pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{String(ins.severity)}</Badge>
                    <span className="text-sm font-medium">{String(ins.title)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{String(ins.summary || "")}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-3">
        <Input
          className="max-w-sm"
          placeholder="Filter label modules…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="space-y-6">
        {[...groups.entries()].map(([group, items]) => (
          <div key={group}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((m) => (
                <Link
                  key={m.href + m.title}
                  href={m.href}
                  className="rounded-md border px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between"
                >
                  <span>{m.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
