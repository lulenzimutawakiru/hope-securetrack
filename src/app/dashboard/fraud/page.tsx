"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";
import type { FraudAlert } from "@/types/database";

export default function FraudPage() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");

  const load = async () => {
    const supabase = createClient();
    let query = supabase
      .from("fraud_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;
    setAlerts((data as FraudAlert[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient();
    const updates: Record<string, unknown> = { status };
    if (status === "resolved" || status === "dismissed") {
      updates.resolved_at = new Date().toISOString();
    }
    const crudRes = await crudUpdate("fraud_alerts", id, updates);
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Alert updated");
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Fraud Alerts"
        description="Investigate counterfeit signals and suspicious verification patterns"
        actions={
          <div className="flex gap-2">
            {["open", "investigating", "resolved", "all"].map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
                className="capitalize"
              >
                {f}
              </Button>
            ))}
          </div>
        }
      />

      {alerts.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No fraud alerts"
          description="Alerts are generated automatically by the verification engine"
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{a.title}</p>
                      {a.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {a.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {a.alert_type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={a.severity} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(a.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Select
                      value={a.status}
                      onValueChange={(v) => updateStatus(a.id, v)}
                    >
                      <SelectTrigger className="w-[150px] ml-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="investigating">Investigating</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="dismissed">Dismissed</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
