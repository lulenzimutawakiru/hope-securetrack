"use client";

import { useEffect, useState } from "react";
import {
  Play, Pause, Square, AlertTriangle, Scissors, Package, RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { shopFloorEvent, DOWNTIME_REASONS } from "@/lib/mes";

type WorkOrder = {
  id: string;
  work_order_number: string;
  operation_name: string | null;
  operation_no: number;
  status: string;
  planned_qty: number;
  completed_qty: number;
  scrap_qty: number;
  production_order_id: string;
  machine_id: string | null;
  mes_production_orders?: {
    order_number: string;
    product_name: string | null;
    batch_number: string | null;
    status: string;
  } | null;
};

export default function ShopFloorPage() {
  const { auth } = useUser();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [qty, setQty] = useState("10");
  const [scrap, setScrap] = useState("0");
  const [reason, setReason] = useState("BREAK");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: ev }] = await Promise.all([
      supabase
        .from("mes_work_orders")
        .select("*, mes_production_orders(order_number,product_name,batch_number,status)")
        .in("status", ["ready", "running", "paused", "pending"])
        .order("operation_no")
        .limit(100),
      supabase
        .from("mes_shop_floor_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setOrders((data as WorkOrder[]) || []);
    setEvents((ev as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
    const t = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(t);
  }, []);

  const act = async (event_type: string, quantity?: number) => {
    if (!selected || !companyId) {
      toast.error("Select a work order");
      return;
    }
    setBusy(true);
    try {
      await shopFloorEvent({
        company_id: companyId,
        production_order_id: selected.production_order_id,
        work_order_id: selected.id,
        machine_id: selected.machine_id,
        event_type,
        quantity: quantity ?? null,
        reason_code: event_type === "downtime" || event_type === "scrap" ? reason : null,
        message: message || null,
        operator_id: auth?.user?.id,
      });
      toast.success(`${event_type} recorded`);
      setMessage("");
      await load();
      const refreshed = (await createClient()
        .from("mes_work_orders")
        .select("*, mes_production_orders(order_number,product_name,batch_number,status)")
        .eq("id", selected.id)
        .single()).data as WorkOrder | null;
      if (refreshed) setSelected(refreshed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading shop floor…" />;

  return (
    <div>
      <PageHeader
        title="Shop Floor Execution"
        description="Tablet-friendly operator interface · start · pause · report · downtime"
        actions={
          <Button size="sm" variant="outline" onClick={() => load()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Active work orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
            {orders.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No ready/running work orders. Release a production order first.
              </p>
            )}
            {orders.map((wo) => (
              <button
                key={wo.id}
                type="button"
                onClick={() => setSelected(wo)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  selected?.id === wo.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{wo.work_order_number}</span>
                  <StatusBadge status={wo.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Op {wo.operation_no}: {wo.operation_name || "—"}
                </p>
                <p className="text-xs mt-0.5">
                  {wo.mes_production_orders?.product_name || "—"} ·{" "}
                  {formatNumber(wo.completed_qty)}/{formatNumber(wo.planned_qty)}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {selected
                ? `${selected.operation_name || "Operation"} · ${selected.mes_production_orders?.order_number || ""}`
                : "Select a job"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-muted-foreground text-sm">Choose a work order to execute.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Batch {selected.mes_production_orders?.batch_number || "—"}</Badge>
                  <Badge variant="outline">
                    {formatNumber(selected.completed_qty)} / {formatNumber(selected.planned_qty)} done
                  </Badge>
                  <Badge variant="outline" className="capitalize">{selected.status}</Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Button
                    size="lg"
                    className="h-16 text-base"
                    disabled={busy || selected.status === "running"}
                    onClick={() => act(selected.status === "paused" ? "resume" : "start")}
                  >
                    <Play className="h-5 w-5 mr-2" />
                    {selected.status === "paused" ? "Resume" : "Start"}
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-16 text-base"
                    disabled={busy || selected.status !== "running"}
                    onClick={() => act("pause")}
                  >
                    <Pause className="h-5 w-5 mr-2" /> Pause
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-16 text-base"
                    disabled={busy}
                    onClick={() => act("complete", Number(qty) || 0)}
                  >
                    <Square className="h-5 w-5 mr-2" /> Complete
                  </Button>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Good quantity</Label>
                    <Input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className="text-lg h-12" />
                  </div>
                  <div>
                    <Label>Scrap quantity</Label>
                    <Input type="number" min="0" value={scrap} onChange={(e) => setScrap(e.target.value)} className="text-lg h-12" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => act("scrap", Number(scrap) || 0)}
                  >
                    <Scissors className="h-4 w-4 mr-1" /> Report scrap
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => act("downtime")}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" /> Downtime
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => act("material_request")}
                  >
                    <Package className="h-4 w-4 mr-1" /> Request material
                  </Button>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Reason code</Label>
                    <Select value={reason} onValueChange={setReason}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOWNTIME_REASONS.map((r) => (
                          <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Notes / issue</Label>
                    <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional comment" />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Live event feed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {events.map((e) => (
              <div key={String(e.id)} className="flex items-center justify-between text-sm border-b py-1.5 last:border-0">
                <span className="capitalize font-medium">{String(e.event_type)}</span>
                <span className="text-muted-foreground text-xs truncate max-w-[50%]">
                  {e.message ? String(e.message) : e.quantity != null ? `qty ${e.quantity}` : "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {e.created_at ? new Date(String(e.created_at)).toLocaleTimeString() : ""}
                </span>
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
