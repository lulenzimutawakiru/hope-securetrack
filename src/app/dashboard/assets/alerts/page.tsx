"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function AssetAlertsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await createClient()
      .from("ast_alerts")
      .select("*, ast_assets(asset_tag, name)")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const ack = async (id: string) => {
    await createClient()
      .from("ast_alerts")
      .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Acknowledged");
    await load();
  };

  const resolve = async (id: string) => {
    await createClient()
      .from("ast_alerts")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Resolved");
    await load();
  };

  if (loading) return <LoadingState message="Loading alerts…" />;

  const severityVariant = (s: string) => {
    if (s === "critical" || s === "high") return "destructive" as const;
    if (s === "medium") return "default" as const;
    return "outline" as const;
  };

  return (
    <div>
      <PageHeader
        title="Asset Alerts"
        description="Warranty · calibration · unauthorized movement · geofence · duplicates"
      />

      {rows.length === 0 ? (
        <EmptyState title="No alerts" description="Warranty and movement alerts appear here." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const a = r.ast_assets as { asset_tag?: string; name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell>
                      <Badge variant={severityVariant(String(r.severity))} className="text-[10px] capitalize">
                        {String(r.severity || "info")}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-xs">{String(r.alert_type)}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm flex items-center gap-1">
                        <Bell className="h-3 w-3" /> {String(r.title)}
                      </p>
                      {r.detail ? <p className="text-xs text-muted-foreground">{String(r.detail)}</p> : null}
                    </TableCell>
                    <TableCell>
                      {r.asset_id ? (
                        <Link href={`/dashboard/assets/${r.asset_id}`} className="font-mono text-xs text-primary hover:underline">
                          {a?.asset_tag || "—"}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">{String(r.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.status === "open" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => ack(String(r.id))}>Ack</Button>
                          <Button size="sm" variant="outline" onClick={() => resolve(String(r.id))}>
                            <Check className="h-3 w-3 mr-1" /> Resolve
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
