"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function MonitorPage() {
  const [checks, setChecks] = useState<Array<Record<string, unknown>>>([]);
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([]);
  const [apiLogs, setApiLogs] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const [h, a, l] = await Promise.all([
      supabase.from("intg_health_checks").select("*, intg_connections(name)").order("checked_at", { ascending: false }).limit(30),
      supabase.from("intg_alerts").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("intg_api_logs").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setChecks(h.data ?? []);
    setAlerts(a.data ?? []);
    setApiLogs(l.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const resolve = async (id: string) => {
    const supabase = createClient();
    await supabase
      .from("intg_alerts")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Alert resolved");
    await load();
  };

  if (loading) return <LoadingState message="Loading monitoring…" />;

  const ok = checks.filter((c) => c.success).length;
  const fail = checks.filter((c) => !c.success).length;
  const openAlerts = alerts.filter((a) => a.status === "open").length;

  return (
    <div>
      <PageHeader
        title="Integration Monitoring"
        description="API health · failed requests · latency · queue · uptime · traffic"
      />
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <StatCard title="Health OK" value={String(ok)} icon={CheckCircle} />
        <StatCard title="Health fail" value={String(fail)} icon={XCircle} />
        <StatCard title="Open alerts" value={String(openAlerts)} icon={Activity} />
        <StatCard title="API samples" value={String(apiLogs.length)} icon={Activity} />
      </div>

      <h3 className="text-sm font-semibold mb-2">Health checks</h3>
      <div className="rounded-md border overflow-x-auto mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Connection</TableHead>
              <TableHead>OK</TableHead>
              <TableHead>Latency</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checks.map((c) => (
              <TableRow key={String(c.id)}>
                <TableCell className="text-xs">{(c.intg_connections as { name?: string } | null)?.name}</TableCell>
                <TableCell>{c.success ? "Yes" : "No"}</TableCell>
                <TableCell className="text-xs">{String(c.latency_ms)} ms</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{String(c.message)}</TableCell>
                <TableCell className="text-xs">{new Date(String(c.checked_at)).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2">Alerts</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((a) => (
              <TableRow key={String(a.id)}>
                <TableCell className="text-xs">{String(a.severity)}</TableCell>
                <TableCell className="text-sm">{String(a.title)}</TableCell>
                <TableCell><StatusBadge status={String(a.status)} /></TableCell>
                <TableCell>
                  {a.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => resolve(String(a.id))}>Resolve</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
