"use client";

import { useEffect, useState } from "react";
import { ScanLine, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { REAMS_PER_CARTON } from "@/lib/constants";
import { toast } from "sonner";
import { packCarton } from "@/lib/packaging";

export default function PackingFloorPage() {
  const { auth } = useUser();
  const [serials, setSerials] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [packing, setPacking] = useState(false);
  const [workOrders, setWorkOrders] = useState<Array<Record<string, unknown>>>([]);
  const [lines, setLines] = useState<Array<Record<string, unknown>>>([]);
  const [woId, setWoId] = useState("");
  const [lineId, setLineId] = useState("");
  const [lastResult, setLastResult] = useState<{
    carton_serial: string;
    qr_payload: string;
  } | null>(null);
  const [todayCartons, setTodayCartons] = useState(0);

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [{ data: wo }, { data: ln }, { count }] = await Promise.all([
        sb.from("pkg_work_orders").select("id,wo_number,product_name,status").in("status", ["released", "in_progress"]).limit(50),
        sb.from("pkg_lines").select("id,name,line_code").eq("is_active", true),
        sb.from("cartons").select("*", { count: "exact", head: true }),
      ]);
      setWorkOrders((wo as Array<Record<string, unknown>>) || []);
      setLines((ln as Array<Record<string, unknown>>) || []);
      setTodayCartons(count ?? 0);
    }
    load().catch(() => undefined);
  }, [lastResult]);

  const addSerial = () => {
    const s = input.trim().toUpperCase();
    if (!s) return;
    if (serials.includes(s)) {
      toast.error("Already scanned");
      return;
    }
    if (serials.length >= REAMS_PER_CARTON) {
      toast.error(`Max ${REAMS_PER_CARTON} reams per carton`);
      return;
    }
    setSerials([...serials, s]);
    setInput("");
  };

  const pack = async () => {
    if (!companyId || serials.length !== REAMS_PER_CARTON) return;
    setPacking(true);
    try {
      const result = await packCarton({
        company_id: companyId,
        ream_serials: serials,
        work_order_id: woId || null,
        line_id: lineId || null,
        packed_by: auth?.user?.id,
        expected_count: REAMS_PER_CARTON,
      });
      setLastResult({
        carton_serial: result.carton_serial,
        qr_payload: result.qr_payload,
      });
      toast.success(`Carton ${result.carton_serial} packed`);
      setSerials([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pack failed");
    } finally {
      setPacking(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Packing Floor"
        description={`Scan ${REAMS_PER_CARTON} ream QR serials → seal carton → master QR`}
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <div>
          <Label>Work order</Label>
          <Select value={woId || "none"} onValueChange={(v) => setWoId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {workOrders.map((w) => (
                <SelectItem key={String(w.id)} value={String(w.id)}>
                  {String(w.wo_number)} · {String(w.product_name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Packing line</Label>
          <Select value={lineId || "none"} onValueChange={(v) => setLineId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {lines.map((l) => (
                <SelectItem key={String(l.id)} value={String(l.id)}>{String(l.name)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Badge variant="outline">Cartons in system: {todayCartons}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="h-4 w-4" /> Scan reams ({serials.length}/{REAMS_PER_CARTON})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Scan or type ream serial"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSerial())}
                autoFocus
              />
              <Button type="button" onClick={addSerial}>Add</Button>
            </div>
            <div className="space-y-1">
              {serials.map((s) => (
                <div key={s} className="flex justify-between rounded border px-3 py-2 text-sm font-mono">
                  <span>{s}</span>
                  <button type="button" className="text-xs text-muted-foreground" onClick={() => setSerials(serials.filter((x) => x !== s))}>
                    Remove
                  </button>
                </div>
              ))}
              {Array.from({ length: REAMS_PER_CARTON - serials.length }).map((_, i) => (
                <div key={i} className="rounded border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  Slot {serials.length + i + 1} empty
                </div>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={packing || serials.length !== REAMS_PER_CARTON}
              onClick={pack}
            >
              <Package className="h-4 w-4 mr-1" />
              {packing ? "Packing…" : `Pack carton (${REAMS_PER_CARTON} reams)`}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last carton</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {!lastResult ? (
              <p className="text-muted-foreground">Packed cartons appear here with master QR payload.</p>
            ) : (
              <>
                <p className="font-mono font-semibold text-lg">{lastResult.carton_serial}</p>
                <p className="text-xs text-muted-foreground">Master QR payload:</p>
                <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
                  {lastResult.qr_payload}
                </pre>
                <p className="text-xs">Print carton label via Print Ops · Product Labels or Templates.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
