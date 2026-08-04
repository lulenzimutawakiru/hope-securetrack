"use client";

import { useEffect, useState } from "react";
import { Cpu, Plus, Radio } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function IotPage() {
  const { auth } = useUser();
  const [devices, setDevices] = useState<Array<Record<string, unknown>>>([]);
  const [telemetry, setTelemetry] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    protocol: "mqtt",
    device_type: "sensor",
    endpoint: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: d }, { data: t }] = await Promise.all([
      supabase.from("intg_iot_devices").select("*").order("name"),
      supabase.from("intg_iot_telemetry").select("*, intg_iot_devices(name,device_code)").order("recorded_at", { ascending: false }).limit(40),
    ]);
    setDevices(d ?? []);
    setTelemetry(t ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const code = `DEV-${Date.now().toString(36).toUpperCase()}`;
      const crudRes3 = await crudCreate("intg_iot_devices", {
        company_id: auth.profile.company_id,
        device_code: code,
        name: form.name,
        protocol: form.protocol,
        device_type: form.device_type,
        endpoint: form.endpoint || null,
        status: "online",
        last_seen_at: new Date().toISOString(),
        is_active: true,
      });
      if (!crudRes3.ok) throw new Error(crudRes3.error);
      toast.success("IoT device registered");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const ingestSample = async (deviceId: string) => {
    if (!auth?.profile?.company_id) return;
    const metrics = [
      { metric: "temperature", value_num: 40 + Math.random() * 40, unit: "C" },
      { metric: "pressure", value_num: 1 + Math.random() * 2, unit: "bar" },
      { metric: "speed", value_num: 100 + Math.random() * 200, unit: "rpm" },
      { metric: "energy", value_num: 10 + Math.random() * 50, unit: "kWh" },
      { metric: "counter", value_num: Math.floor(Math.random() * 1000), unit: "pcs" },
    ];
    const m = metrics[Math.floor(Math.random() * metrics.length)];
    const supabase = createClient();
    const crudRes2 = await crudCreate("intg_iot_telemetry", {
      company_id: auth.profile.company_id,
      device_id: deviceId,
      metric: m.metric,
      value_num: m.value_num,
      unit: m.unit,
    });
    const crudRes = await crudUpdate("intg_iot_devices", deviceId, { last_seen_at: new Date().toISOString(), status: "online" });
    toast.success(`Ingested ${m.metric}`);
    await load();
  };

  if (loading) return <LoadingState message="Loading IoT devices…" />;

  return (
    <div>
      <PageHeader
        title="IoT / Industry 4.0"
        description="MQTT · OPC-UA · Modbus · PLC · SCADA · sensors · energy · counters"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Register device</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>IoT device</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div>
                  <Label>Protocol</Label>
                  <Select value={form.protocol} onValueChange={(v) => setForm((f) => ({ ...f, protocol: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["mqtt", "opcua", "modbus", "rest", "tcp", "ethernet_ip"].map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.device_type} onValueChange={(v) => setForm((f) => ({ ...f, device_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["sensor", "plc", "scada", "machine", "counter", "energy"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Endpoint</Label><Input value={form.endpoint} onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))} placeholder="mqtt://... or opc.tcp://..." /></div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {devices.map((d) => (
          <Card key={String(d.id)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4 w-4 text-teal-700" /> {String(d.name)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-mono text-xs">{String(d.device_code)}</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline">{String(d.protocol)}</Badge>
                <Badge variant="outline">{String(d.device_type)}</Badge>
                <StatusBadge status={String(d.status)} />
              </div>
              <p className="text-xs text-muted-foreground truncate">{String(d.endpoint || "—")}</p>
              <Button size="sm" variant="outline" onClick={() => ingestSample(String(d.id))}>
                <Radio className="h-3.5 w-3.5 mr-1" /> Sample telemetry
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <h3 className="text-sm font-semibold mb-2">Telemetry</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Metric</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {telemetry.map((t) => (
              <TableRow key={String(t.id)}>
                <TableCell className="text-xs">{(t.intg_iot_devices as { name?: string } | null)?.name}</TableCell>
                <TableCell className="text-xs">{String(t.metric)}</TableCell>
                <TableCell className="text-xs font-mono">{Number(t.value_num).toFixed(2)}</TableCell>
                <TableCell className="text-xs">{String(t.unit || "—")}</TableCell>
                <TableCell className="text-xs">{new Date(String(t.recorded_at)).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
