"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function LiveAttendancePage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [present, setPresent] = useState<Array<Record<string, unknown>>>([]);
  const [devices, setDevices] = useState<Array<Record<string, unknown>>>([]);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    try {
      const sb = createClient();
      const [{ data: att }, { data: dev }, { data: ev }] = await Promise.all([
        sb
          .from("attendance_records")
          .select("*, employees(first_name,last_name,employee_number)")
          .eq("company_id", companyId)
          .eq("work_date", today)
          .not("check_in", "is", null)
          .is("check_out", null)
          .order("check_in", { ascending: false })
          .limit(100),
        sb
          .from("att_devices")
          .select("device_code,name,vendor,status,last_heartbeat_at,branch_name")
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .order("status")
          .limit(50),
        sb
          .from("att_events")
          .select("*")
          .eq("company_id", companyId)
          .eq("work_date", today)
          .is("deleted_at", null)
          .order("event_at", { ascending: false })
          .limit(20),
      ]);
      setPresent((att as Array<Record<string, unknown>>) || []);
      setDevices((dev as Array<Record<string, unknown>>) || []);
      setEvents((ev as Array<Record<string, unknown>>) || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [companyId]);

  if (loading) return <LoadingState message="Loading live attendance…" />;

  return (
    <div>
      <PageHeader
        title="Live Attendance"
        description="Who is present · device health · live event stream (auto-refresh 30s)"
        actions={
          <Button size="sm" variant="outline" onClick={() => { setLoading(true); load(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Present ({present.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
            {present.length === 0 && (
              <p className="text-sm text-muted-foreground">No active clock-ins today.</p>
            )}
            {present.map((r) => {
              const emp = r.employees as { first_name?: string; last_name?: string; employee_number?: string } | null;
              return (
                <div key={String(r.id)} className="border rounded-md px-3 py-2 text-sm">
                  <div className="font-medium">
                    {emp ? `${emp.first_name} ${emp.last_name}` : "Employee"} · {emp?.employee_number}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    In {String(r.check_in || "").slice(11, 19)} · {String(r.location_name || "—")}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Devices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
            {devices.map((d) => (
              <div key={String(d.device_code)} className="flex justify-between border rounded-md px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{String(d.name)}</div>
                  <div className="text-xs text-muted-foreground">
                    {String(d.vendor)} · {String(d.branch_name || "")}
                  </div>
                </div>
                <Badge variant={String(d.status) === "online" ? "default" : "destructive"}>
                  {String(d.status)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Event stream</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
            {events.map((e) => (
              <div key={String(e.id)} className="border rounded-md px-3 py-2 text-sm">
                <div className="font-medium">
                  {String(e.employee_name)} · {String(e.event_type)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {String(e.location_name || "—")} · {String(e.method)} · {String(e.event_at || "").slice(0, 19)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
