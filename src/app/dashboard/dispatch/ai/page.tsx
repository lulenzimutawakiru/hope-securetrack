"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wand2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import {
  generateDispatchInsights,
  predictDelayMinutes,
  recommendVehicleType,
  type DispatchAiInsight,
} from "@/lib/dispatch";

export default function DispatchAiPage() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<DispatchAiInsight[]>([]);
  const [stored, setStored] = useState<Array<Record<string, unknown>>>([]);
  const [delayHint, setDelayHint] = useState("");
  const [vehicleHint, setVehicleHint] = useState("");

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [
        { count: pending },
        { count: inTransit },
        { count: failed },
        { count: availableVehicles },
        { count: availableDrivers },
        { count: openExceptions },
        { count: delivered },
        { count: total },
        { count: idleVehicles },
        { count: mismatches },
        { data: ai },
      ] = await Promise.all([
        sb.from("dsp_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("dsp_requests").select("*", { count: "exact", head: true }).eq("status", "in_transit"),
        sb.from("dsp_requests").select("*", { count: "exact", head: true }).eq("status", "failed"),
        sb.from("fleet_vehicles").select("*", { count: "exact", head: true }).eq("status", "available"),
        sb.from("dsp_drivers").select("*", { count: "exact", head: true }).eq("status", "available"),
        sb.from("dsp_exceptions").select("*", { count: "exact", head: true }).eq("status", "open"),
        sb.from("dsp_requests").select("*", { count: "exact", head: true }).eq("status", "delivered"),
        sb.from("dsp_requests").select("*", { count: "exact", head: true }),
        sb.from("fleet_vehicles").select("*", { count: "exact", head: true }).eq("status", "available"),
        sb.from("dsp_loading_sessions").select("*", { count: "exact", head: true }).gt("mismatch_count", 0),
        sb.from("dsp_ai_insights").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(10),
      ]);

      const onTimePct =
        (total ?? 0) > 0
          ? Math.round(((delivered ?? 0) / Math.max(1, (delivered ?? 0) + (failed ?? 0))) * 100)
          : 100;

      setInsights(
        generateDispatchInsights({
          pendingRequests: pending ?? 0,
          inTransit: inTransit ?? 0,
          failed: failed ?? 0,
          availableVehicles: availableVehicles ?? 0,
          availableDrivers: availableDrivers ?? 0,
          openExceptions: openExceptions ?? 0,
          onTimePct,
          idleVehicles: idleVehicles ?? 0,
          loadingMismatches: mismatches ?? 0,
        })
      );
      setStored((ai as Array<Record<string, unknown>>) || []);
      const hour = new Date().getHours();
      const delay = predictDelayMinutes({ distanceKm: 25, stops: 3, hourOfDay: hour });
      setDelayHint(`Predicted metro delay for 25 km / 3 stops at hour ${hour}: ~${delay} minutes.`);
      setVehicleHint(
        `For 800 kg / 3 m³ load recommend vehicle type: ${recommendVehicleType(800, 3)}.`
      );
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading AI dispatch assistant…" />;

  return (
    <div>
      <PageHeader
        title="AI Dispatch Assistant"
        description="Delay prediction · vehicle recommend · fleet demand · route efficiency · loading sequence"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Live insights
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
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/dispatch/routes">Routes</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/dispatch/planning">Planning</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/dispatch/exceptions">Exceptions</Link></Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Predictive hints</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>{delayHint}</p>
              <p>{vehicleHint}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Stored AI insights</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {stored.map((r) => (
                <div key={String(r.id)} className="border rounded p-2 text-sm">
                  <Badge variant="outline" className="text-[10px] mb-1 capitalize">{String(r.severity)}</Badge>
                  <p className="font-medium">{String(r.title)}</p>
                  <p className="text-xs text-muted-foreground">{String(r.detail || "")}</p>
                </div>
              ))}
              {stored.length === 0 && (
                <p className="text-sm text-muted-foreground">Seed insights after migration 00041.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
