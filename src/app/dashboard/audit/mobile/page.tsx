"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Smartphone, ShieldAlert, Search, Siren, FileBarChart, Activity,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

export default function AuditMobilePage() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([]);
  const [incidents, setIncidents] = useState<Array<Record<string, unknown>>>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [{ data: a }, { data: i }] = await Promise.all([
        sb.from("eal_alerts").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(8),
        sb.from("eal_incidents").select("*").in("status", ["open", "investigating"]).order("created_at", { ascending: false }).limit(5),
      ]);
      setAlerts((a as Array<Record<string, unknown>>) || []);
      setIncidents((i as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const search = async () => {
    if (!q.trim()) return;
    const { data } = await createClient()
      .from("eal_events")
      .select("audit_id, action, module, severity, user_email, created_at, risk_score")
      .or(`audit_id.ilike.%${q}%,action.ilike.%${q}%,user_email.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(15);
    setHits((data as Array<Record<string, unknown>>) || []);
    toast.success(`${data?.length || 0} hit(s)`);
  };

  if (loading) return <LoadingState message="Loading mobile audit center…" />;

  return (
    <div className="max-w-lg mx-auto pb-20">
      <PageHeader
        title="Mobile Audit Center"
        description="PWA · alerts · search · incidents · reports · Android/iOS/tablet"
      />

      <Card className="mb-4 border-primary/20">
        <CardContent className="pt-4 flex items-start gap-3 text-sm">
          <Smartphone className="h-5 w-5 text-primary shrink-0" />
          <p>
            Install Hope SecureTrack as a PWA for home-screen access, push-ready alerts,
            and offline-capable investigation queues.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Button asChild variant="outline" className="h-16 flex-col gap-1">
          <Link href="/dashboard/audit/live"><Activity className="h-5 w-5" /><span className="text-xs">Live</span></Link>
        </Button>
        <Button asChild variant="outline" className="h-16 flex-col gap-1">
          <Link href="/dashboard/audit/alerts"><ShieldAlert className="h-5 w-5" /><span className="text-xs">Alerts</span></Link>
        </Button>
        <Button asChild variant="outline" className="h-16 flex-col gap-1">
          <Link href="/dashboard/audit/incidents"><Siren className="h-5 w-5" /><span className="text-xs">Incidents</span></Link>
        </Button>
        <Button asChild variant="outline" className="h-16 flex-col gap-1">
          <Link href="/dashboard/audit/reports"><FileBarChart className="h-5 w-5" /><span className="text-xs">Reports</span></Link>
        </Button>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Search className="h-4 w-4" /> Quick search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="User, audit ID, action…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <Button className="w-full" size="sm" onClick={search}>Search events</Button>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {hits.map((h, i) => (
              <div key={i} className="text-xs border rounded p-2">
                <div className="flex justify-between">
                  <span className="font-mono">{String(h.audit_id)}</span>
                  <Badge variant="outline" className="text-[9px]">{String(h.severity)}</Badge>
                </div>
                <p className="truncate">{String(h.action)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Live alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {alerts.map((a) => (
            <div key={String(a.id)} className="border rounded p-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium line-clamp-1">{String(a.title)}</span>
                <Badge variant={a.severity === "high" || a.severity === "critical" ? "destructive" : "outline"} className="text-[9px] shrink-0">
                  {String(a.severity)}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">{formatDateTime(String(a.created_at))}</p>
            </div>
          ))}
          {alerts.length === 0 && <p className="text-xs text-muted-foreground">No open alerts</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Investigations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {incidents.map((i) => (
            <div key={String(i.id)} className="border rounded p-2 text-sm">
              <p className="font-mono text-xs">{String(i.incident_number)}</p>
              <p className="font-medium line-clamp-1">{String(i.title)}</p>
              <Badge variant="outline" className="text-[9px] capitalize mt-1">{String(i.status)}</Badge>
            </div>
          ))}
          {incidents.length === 0 && <p className="text-xs text-muted-foreground">No open incidents</p>}
          <Button asChild size="sm" variant="outline" className="w-full">
            <Link href="/dashboard/audit/incidents">Open investigation board</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
