"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wand2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import {
  generatePrintInsights,
  suggestPrinterForDocument,
  type PrintAiInsight,
} from "@/lib/print";

export default function PrintAiPage() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<PrintAiInsight[]>([]);
  const [docType, setDocType] = useState("qr_auth");
  const [suggestion, setSuggestion] = useState("");

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [
        { count: offline },
        { count: queued },
        { count: failed },
        { data: media },
        { count: defaults },
        { data: consumables },
        { count: alerts },
        { data: quotas },
        { count: held },
        { data: batches },
      ] = await Promise.all([
        sb.from("printers").select("*", { count: "exact", head: true }).neq("status", "online").eq("is_active", true),
        sb.from("prt_queue").select("*", { count: "exact", head: true }).eq("status", "queued"),
        sb.from("prt_queue").select("*", { count: "exact", head: true }).eq("status", "failed"),
        sb.from("prt_media").select("stock_qty,reorder_level"),
        sb.from("printers").select("*", { count: "exact", head: true }).eq("is_default", true),
        sb.from("prt_consumables").select("level_pct"),
        sb.from("prt_alerts").select("*", { count: "exact", head: true }).eq("status", "open"),
        sb.from("prt_quotas").select("used_pages,max_pages,used_labels,max_labels"),
        sb.from("prt_queue").select("*", { count: "exact", head: true }).eq("status", "held"),
        sb.from("prt_batches").select("total_items,completed_items").limit(10),
      ]);
      const lowMedia = (media || []).filter(
        (m) => Number(m.stock_qty) <= Number(m.reorder_level)
      ).length;
      const lowToner = (consumables || []).filter((c) => Number(c.level_pct) < 25).length;
      const quotaNear = (quotas || []).some(
        (q) =>
          Number(q.used_pages) / Math.max(1, Number(q.max_pages)) >= 0.85 ||
          Number(q.used_labels) / Math.max(1, Number(q.max_labels)) >= 0.85
      );
      const labelsPrintedMonth = (batches || []).reduce(
        (s, b) => s + Number(b.completed_items || 0),
        0
      );
      setInsights(
        generatePrintInsights({
          offlinePrinters: offline ?? 0,
          queuedJobs: queued ?? 0,
          failedJobs: failed ?? 0,
          lowMedia,
          lowToner,
          openAlerts: alerts ?? 0,
          quotaNearLimit: quotaNear,
          heldSecure: held ?? 0,
          noDefaultPrinter: (defaults ?? 0) === 0,
          labelsPrintedMonth,
        })
      );
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading AI print assistant…" />;

  return (
    <div>
      <PageHeader
        title="AI Print Assistant"
        description="Failures · failover · consumables · quotas · volume forecast · secure release"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((ins, i) => (
              <div key={i} className="rounded-md border p-3">
                <div className="flex gap-2 mb-1">
                  <Badge
                    variant={ins.severity === "high" ? "destructive" : ins.severity === "medium" ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {ins.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">{ins.type}</Badge>
                </div>
                <p className="font-medium text-sm">{ins.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{ins.detail}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {ins.actions.map((a) => (
                    <Badge key={a} variant="secondary" className="text-[10px] font-normal">{a}</Badge>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/print/queue">Queue</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/print/server">Servers</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/print/consumables">Consumables</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/print/release">Secure release</Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Optimal printer routing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="text-sm font-medium">Document type</label>
            <Input
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              placeholder="qr_auth | shipping | invoice | id_card"
            />
            <Button
              size="sm"
              onClick={() => setSuggestion(suggestPrinterForDocument(docType.trim()))}
            >
              Recommend printer
            </Button>
            {suggestion && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">{suggestion}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Failover uses least-queue online printers on the print server when preferred device is offline.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
