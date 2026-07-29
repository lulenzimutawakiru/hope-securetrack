"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Warehouse } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { assignResources } from "@/lib/dispatch";

export default function DispatchPlanningPage() {
  const { auth } = useUser();
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [vehicles, setVehicles] = useState<Array<Record<string, unknown>>>([]);
  const [drivers, setDrivers] = useState<Array<Record<string, unknown>>>([]);
  const [bays, setBays] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data: r }, { data: v }, { data: d }, { data: b }] = await Promise.all([
      sb.from("dsp_requests").select("*").in("status", ["pending", "planned", "assigned"]).is("deleted_at", null).order("priority"),
      sb.from("fleet_vehicles").select("id, registration, status, vehicle_type, capacity_kg").eq("status", "available"),
      sb.from("dsp_drivers").select("id, driver_code, full_name, status").eq("status", "available"),
      sb.from("dsp_loading_bays").select("*").eq("is_active", true),
    ]);
    setRequests((r as Array<Record<string, unknown>>) || []);
    setVehicles((v as Array<Record<string, unknown>>) || []);
    setDrivers((d as Array<Record<string, unknown>>) || []);
    setBays((b as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const autoAssign = async (requestId: string) => {
    if (!companyId) return;
    const v = vehicles[0];
    const d = drivers[0];
    try {
      await assignResources({
        company_id: companyId,
        request_id: requestId,
        vehicle_id: v ? String(v.id) : null,
        driver_id: d ? String(d.id) : null,
        actor_id: userId,
      });
      toast.success(`Assigned ${v ? v.registration : "—"} / ${d ? d.full_name : "—"}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Assign failed");
    }
  };

  if (loading) return <LoadingState message="Loading planning board…" />;

  return (
    <div>
      <PageHeader
        title="Delivery Planning"
        description="Group · allocate vehicles/drivers · reserve loading bays · same-day & multi-stop"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/dispatch/routes">Optimize routes</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Available vehicles</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {vehicles.map((v) => (
              <div key={String(v.id)} className="flex justify-between border-b py-1">
                <span className="font-mono text-xs">{String(v.registration)}</span>
                <span className="text-xs capitalize">{String(v.vehicle_type)}</span>
              </div>
            ))}
            {vehicles.length === 0 && <p className="text-xs text-muted-foreground">None available</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Available drivers</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {drivers.map((d) => (
              <div key={String(d.id)} className="flex justify-between border-b py-1">
                <span>{String(d.full_name)}</span>
                <span className="font-mono text-xs">{String(d.driver_code)}</span>
              </div>
            ))}
            {drivers.length === 0 && <p className="text-xs text-muted-foreground">None available</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-1"><Warehouse className="h-4 w-4" /> Loading bays</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {bays.map((b) => (
              <div key={String(b.id)} className="flex justify-between border-b py-1">
                <span>{String(b.name)}</span>
                <Badge variant="outline" className="text-[10px] capitalize">{String(b.status)}</Badge>
              </div>
            ))}
            {bays.length === 0 && <p className="text-xs text-muted-foreground">Seed bays via migration</p>}
          </CardContent>
        </Card>
      </div>

      <h3 className="text-sm font-medium mb-2">Request board</h3>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={String(r.id)} className="flex flex-wrap items-center gap-3 border rounded-lg p-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs">{String(r.request_number)}</p>
              <p className="font-medium text-sm">{String(r.customer_name)}</p>
              <p className="text-xs text-muted-foreground truncate">{String(r.delivery_address || "")}</p>
            </div>
            <Badge variant="outline" className="capitalize text-[10px]">{String(r.priority)}</Badge>
            <Badge variant="secondary" className="capitalize text-[10px]">{String(r.status)}</Badge>
            <span className="text-xs">{String(r.weight_kg)} kg</span>
            {r.status === "pending" || r.status === "planned" ? (
              <Button size="sm" onClick={() => autoAssign(String(r.id))}>Auto-assign</Button>
            ) : null}
          </div>
        ))}
        {requests.length === 0 && (
          <p className="text-sm text-muted-foreground">No requests awaiting planning.</p>
        )}
      </div>
    </div>
  );
}
