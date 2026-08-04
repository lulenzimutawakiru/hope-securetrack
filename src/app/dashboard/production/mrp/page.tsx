"use client";

import { useEffect, useState } from "react";
import { Truck, RefreshCw, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";
import { runMrpForOrder } from "@/lib/mes";

type Sug = {
  id: string;
  component_code: string;
  component_name: string;
  required_qty: number;
  on_hand_qty: number;
  shortage_qty: number;
  suggestion: string;
  due_date: string | null;
  source_order: string | null;
  status: string;
};

export default function MrpPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Sug[]>([]);
  const [orders, setOrders] = useState<Array<{ id: string; order_number: string }>>([]);
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: pos }] = await Promise.all([
      supabase.from("mes_mrp_suggestions").select("*").order("created_at", { ascending: false }).limit(300),
      supabase
        .from("mes_production_orders")
        .select("id,order_number")
        .is("deleted_at", null)
        .in("status", ["planned", "released", "in_progress"])
        .limit(100),
    ]);
    setRows((data as Sug[]) || []);
    setOrders((pos as typeof orders) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const run = async () => {
    if (!companyId || !orderId) return toast.error("Select a production order");
    setRunning(true);
    try {
      const result = await runMrpForOrder({ company_id: companyId, production_order_id: orderId });
      toast.success(`MRP: ${result.suggestions.length} shortage(s), ${result.explosion.length} components`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "MRP failed");
    } finally {
      setRunning(false);
    }
  };

  const closeSug = async (id: string) => {
    const crudRes = await crudUpdate("mes_mrp_suggestions", id, { status: "closed" });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Suggestion closed");
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading MRP…" />;

  const open = rows.filter((r) => r.status === "open");
  const shortage = open.reduce((s, r) => s + Number(r.shortage_qty || 0), 0);

  return (
    <div>
      <PageHeader
        title="Material Requirements Planning"
        description="BOM explosion · net requirements · purchase / produce suggestions"
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={orderId || "none"} onValueChange={(v) => setOrderId(v === "none" ? "" : v)}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Production order" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select order</SelectItem>
                {orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.order_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={run} disabled={running}>
              <RefreshCw className={`h-4 w-4 mr-1 ${running ? "animate-spin" : ""}`} />
              Run MRP
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Suggestions" value={String(rows.length)} icon={Truck} />
        <StatCard title="Open" value={String(open.length)} icon={Truck} />
        <StatCard title="Shortage qty" value={formatNumber(shortage)} icon={Truck} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No MRP suggestions" description="Run MRP against a production order with a BOM." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead className="text-right">Required</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Shortage</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-mono text-sm">{r.component_code}</div>
                    <div className="text-xs text-muted-foreground">{r.component_name}</div>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(r.required_qty)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.on_hand_qty)}</TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    {formatNumber(r.shortage_qty)}
                  </TableCell>
                  <TableCell className="capitalize">{r.suggestion}</TableCell>
                  <TableCell className="text-xs font-mono">{r.source_order || "—"}</TableCell>
                  <TableCell className="text-xs">{r.due_date ? formatDate(r.due_date) : "—"}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    {r.status === "open" && (
                      <Button size="icon" variant="ghost" onClick={() => closeSug(r.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
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
