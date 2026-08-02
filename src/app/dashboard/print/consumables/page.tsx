"use client";

import { useEffect, useState } from "react";
import { Droplets, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function PrintConsumablesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data }, { data: a }] = await Promise.all([
      sb.from("prt_consumables").select("*, printers(name,model)").order("level_pct"),
      sb.from("prt_alerts").select("*, printers(name)").eq("status", "open").order("created_at", { ascending: false }).limit(30),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setAlerts((a as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const markReplaced = async (id: string) => {
    const crudRes3 = await crudUpdate("prt_consumables", id, {
        level_pct: 100,
        remaining_units: 1000,
        status: "ok",
        last_replaced_at: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      });
    toast.success("Marked replaced");
    await load();
  };

  const resolveAlert = async (id: string) => {
    const crudRes2 = await crudUpdate("prt_alerts", id, { status: "resolved", resolved_at: new Date().toISOString() });
    toast.success("Alert resolved");
    await load();
  };

  const scanAlerts = async () => {
    if (!companyId) return;
    const low = rows.filter((r) => Number(r.level_pct) < 20 || Number(r.remaining_units) <= Number(r.reorder_level));
    for (const r of low) {
      const crudRes = await crudCreate("prt_alerts", {
        company_id: companyId,
        alert_type: String(r.consumable_type) === "labels" ? "low_labels" : "low_toner",
        severity: "medium",
        title: `Low ${r.consumable_type}: ${r.name}`,
        detail: `Level ${r.level_pct}% · remaining ${r.remaining_units}`,
        printer_id: r.printer_id,
        status: "open",
      });
    }
    toast.success(`Created ${low.length} alert(s)`);
    await load();
  };

  if (loading) return <LoadingState message="Loading consumables…" />;

  const low = rows.filter((r) => Number(r.level_pct) < 25).length;

  return (
    <div>
      <PageHeader
        title="Consumables & Alerts"
        description="Toner · ribbon · labels · paper · maintenance due · offline"
        actions={
          <Button size="sm" variant="outline" onClick={scanAlerts}>Scan low levels</Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Consumable rows" value={String(rows.length)} icon={Droplets} />
        <StatCard title="Low level" value={String(low)} icon={AlertTriangle} />
        <StatCard title="Open alerts" value={String(alerts.length)} icon={AlertTriangle} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Droplets} title="No consumables" description="Seed after migration or link to printers." />
      ) : (
        <div className="rounded-md border mb-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Printer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Level</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const pr = r.printers as { name?: string } | null;
                const pct = Number(r.level_pct);
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="text-sm">{pr?.name || "—"}</TableCell>
                    <TableCell className="capitalize text-sm">{String(r.consumable_type)}</TableCell>
                    <TableCell className="text-sm">{String(r.name)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={pct < 20 ? "destructive" : pct < 40 ? "outline" : "secondary"} className="text-[10px]">
                        {pct}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{String(r.remaining_units)}</TableCell>
                    <TableCell className="capitalize text-sm">{String(r.status)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => markReplaced(String(r.id))}>
                        Replaced
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="text-sm font-medium mb-2">Open alerts</h3>
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open alerts</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => {
            const pr = a.printers as { name?: string } | null;
            return (
              <div key={String(a.id)} className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="font-medium text-sm">{String(a.title)}</p>
                  <p className="text-xs text-muted-foreground">
                    {String(a.alert_type)} · {pr?.name || "fleet"} · {String(a.detail || "")}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => resolveAlert(String(a.id))}>Resolve</Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
