"use client";

import { useEffect, useState } from "react";
import { BarChart3, Printer, ListOrdered, Layers, Radio } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";

export default function PrintAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    printers: 0,
    online: 0,
    queued: 0,
    completed: 0,
    failed: 0,
    templates: 0,
    batches: 0,
    lowMedia: 0,
  });
  const [byType, setByType] = useState<Array<{ type: string; count: number }>>([]);
  const [recent, setRecent] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [
        printers, online, queued, completed, failed, templates, batches,
        { data: media }, { data: queueRows }, { data: printersList },
      ] = await Promise.all([
        sb.from("printers").select("*", { count: "exact", head: true }).eq("is_active", true),
        sb.from("printers").select("*", { count: "exact", head: true }).eq("status", "online"),
        sb.from("prt_queue").select("*", { count: "exact", head: true }).eq("status", "queued"),
        sb.from("prt_queue").select("*", { count: "exact", head: true }).eq("status", "completed"),
        sb.from("prt_queue").select("*", { count: "exact", head: true }).eq("status", "failed"),
        sb.from("prt_templates").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("prt_batches").select("*", { count: "exact", head: true }),
        sb.from("prt_media").select("stock_qty,reorder_level"),
        sb.from("prt_queue").select("document_type,job_title,status,created_at").order("created_at", { ascending: false }).limit(12),
        sb.from("printers").select("printer_type").eq("is_active", true),
      ]);

      const lowMedia = (media || []).filter(
        (m) => Number(m.stock_qty) <= Number(m.reorder_level)
      ).length;

      const typeMap = new Map<string, number>();
      for (const p of printersList || []) {
        const t = String(p.printer_type || "label");
        typeMap.set(t, (typeMap.get(t) || 0) + 1);
      }

      setStats({
        printers: printers.count ?? 0,
        online: online.count ?? 0,
        queued: queued.count ?? 0,
        completed: completed.count ?? 0,
        failed: failed.count ?? 0,
        templates: templates.count ?? 0,
        batches: batches.count ?? 0,
        lowMedia,
      });
      setByType(
        Array.from(typeMap.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count)
      );
      setRecent((queueRows as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading print analytics…" />;

  return (
    <div>
      <PageHeader
        title="Print Analytics"
        description="Volume · device health · failures · media · templates"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Printers" value={String(stats.printers)} icon={Printer} />
        <StatCard title="Online" value={String(stats.online)} icon={Radio} />
        <StatCard title="Queued" value={String(stats.queued)} icon={ListOrdered} />
        <StatCard title="Completed" value={String(stats.completed)} icon={ListOrdered} />
        <StatCard title="Failed" value={String(stats.failed)} icon={ListOrdered} />
        <StatCard title="Templates" value={String(stats.templates)} icon={Layers} />
        <StatCard title="Batches" value={String(stats.batches)} icon={BarChart3} />
        <StatCard title="Low media" value={String(stats.lowMedia)} icon={Radio} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fleet by type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byType.length === 0 ? (
              <p className="text-sm text-muted-foreground">No printers</p>
            ) : (
              byType.map((t) => (
                <div key={t.type} className="flex justify-between text-sm border-b pb-1">
                  <span className="capitalize">{t.type.replace(/_/g, " ")}</span>
                  <span className="font-medium">{t.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent queue activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.map((r, i) => (
              <div key={i} className="flex justify-between text-sm border-b pb-1">
                <span className="truncate mr-2">{String(r.job_title)}</span>
                <span className="text-muted-foreground shrink-0 capitalize text-xs">{String(r.status)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
