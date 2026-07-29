"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, LogOut, MapPin, Shield, RefreshCw, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { useLiveGps } from "@/hooks/use-live-gps";
import { createClient } from "@/lib/supabase/client";
import { processClock, listActiveLocations, distanceMeters } from "@/lib/attendance";
import { toast } from "sonner";

type Emp = { id: string; first_name: string; last_name: string; employee_number: string; email?: string | null };

export default function SecureClockPage() {
  const { auth } = useUser();
  const gps = useLiveGps({ enableHighAccuracy: true, auto: true, watch: true });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [wifiSsid, setWifiSsid] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [isField, setIsField] = useState(false);
  const [projectCode, setProjectCode] = useState("");
  const [nearest, setNearest] = useState<{
    name: string;
    distance: number;
    inside: boolean;
    radius: number;
  } | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [todayStatus, setTodayStatus] = useState<string | null>(null);

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("employees")
        .select("id,first_name,last_name,employee_number,email")
        .eq("status", "active")
        .order("last_name")
        .limit(500);
      const list = (data as Emp[]) || [];
      setEmployees(list);

      // Prefer employee matching signed-in email / name
      const email = auth?.user?.email?.toLowerCase();
      const first = auth?.profile?.first_name?.toLowerCase();
      const last = auth?.profile?.last_name?.toLowerCase();
      const match =
        list.find((e) => e.email && email && e.email.toLowerCase() === email) ||
        list.find(
          (e) =>
            first &&
            last &&
            e.first_name?.toLowerCase() === first &&
            e.last_name?.toLowerCase() === last
        ) ||
        list[0];
      if (match) setEmployeeId(match.id);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [auth]);

  // Nearest geofence vs live GPS
  useEffect(() => {
    async function evalNearest() {
      if (!companyId || !gps.point) {
        setNearest(null);
        return;
      }
      try {
        const locs = await listActiveLocations(companyId);
        let best: { name: string; distance: number; inside: boolean; radius: number } | null =
          null;
        for (const loc of locs) {
          const d = distanceMeters(gps.point!, {
            lat: Number(loc.lat),
            lng: Number(loc.lng),
          });
          if (!best || d < best.distance) {
            best = {
              name: loc.name,
              distance: d,
              inside: d <= Number(loc.radius_m || 0),
              radius: Number(loc.radius_m || 0),
            };
          }
        }
        setNearest(best);
      } catch {
        /* ignore */
      }
    }
    evalNearest();
  }, [companyId, gps.point]);

  // Today's attendance for selected employee
  useEffect(() => {
    async function loadToday() {
      if (!companyId || !employeeId) {
        setTodayStatus(null);
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await createClient()
        .from("attendance_records")
        .select("check_in,check_out,status,location_name,hours_worked")
        .eq("company_id", companyId)
        .eq("employee_id", employeeId)
        .eq("work_date", today)
        .maybeSingle();
      if (!data) {
        setTodayStatus("Not clocked in today");
        return;
      }
      if (data.check_in && !data.check_out) {
        setTodayStatus(
          `Clocked IN at ${String(data.check_in).slice(11, 19)} · ${data.location_name || "—"}`
        );
      } else if (data.check_out) {
        setTodayStatus(
          `Completed · ${data.hours_worked ?? "—"} h · out ${String(data.check_out).slice(11, 19)}`
        );
      } else {
        setTodayStatus(String(data.status || "—"));
      }
    }
    loadToday();
  }, [companyId, employeeId, lastResult]);

  const clock = async (type: "clock_in" | "clock_out") => {
    if (!companyId) return toast.error("No company");
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return toast.error("Select employee");
    if (!gps.point && !isField) {
      toast.error("GPS required — wait for fix or allow location");
      gps.capture();
      return;
    }
    if (gps.point && gps.point.accuracy > 80 && !isField) {
      toast.message("GPS accuracy is low", {
        description: "Move outdoors for a better fix, or continue if still inside the site.",
      });
    }

    setBusy(true);
    setLastResult(null);
    try {
      const result = await processClock({
        companyId,
        employeeId: emp.id,
        employeeName: `${emp.first_name} ${emp.last_name}`,
        employeeNumber: emp.employee_number,
        eventType: type,
        point: gps.point
          ? { lat: gps.point.lat, lng: gps.point.lng, accuracy: gps.point.accuracy }
          : null,
        wifiSsid: wifiSsid || undefined,
        qrToken: qrToken || undefined,
        isFieldWork: isField,
        projectCode: projectCode || undefined,
        actorId: auth?.user?.id,
        mockLocation: false,
      });
      if (result.ok) {
        toast.success(
          result.message + (result.locationName ? ` · ${result.locationName}` : "")
        );
        setLastResult(
          `Approved · ${result.locationName || "field"} · ${
            result.distanceM != null ? result.distanceM + " m from center" : "—"
          }`
        );
      } else {
        toast.error(result.rejectReason || result.message);
        setLastResult(`Rejected · ${result.rejectReason}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clock failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Preparing secure clock…" />;

  const canClockIn = !!nearest?.inside || isField;

  return (
    <div>
      <PageHeader
        title="Secure Clock In / Out"
        description="Live GPS · geofence · multi-factor verification · anti-fraud"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/attendance/locations">
                <Settings2 className="h-4 w-4 mr-1" /> Configure sites
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => gps.capture()} disabled={gps.loading}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh GPS
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Clock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.employee_number} — {e.first_name} {e.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {todayStatus && (
                <p className="text-xs text-muted-foreground mt-1">{todayStatus}</p>
              )}
            </div>

            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <MapPin className="h-4 w-4" /> Live location
              </div>
              {gps.error && <p className="text-destructive text-xs">{gps.error}</p>}
              {gps.point ? (
                <>
                  <p className="text-xs font-mono text-muted-foreground">
                    {gps.point.lat.toFixed(6)}, {gps.point.lng.toFixed(6)} · ±
                    {gps.point.accuracy.toFixed(1)} m
                  </p>
                  {nearest ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={nearest.inside ? "default" : "destructive"}>
                        {nearest.inside ? "Authorized site" : "Outside geofence"}
                      </Badge>
                      <span className="text-xs">
                        {nearest.name} · {Math.round(nearest.distance)} m
                        {nearest.inside ? "" : ` (need ≤ ${nearest.radius} m)`}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No active locations configured.{" "}
                      <Link href="/dashboard/attendance/locations" className="underline text-accent">
                        Set up sites with live GPS
                      </Link>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {gps.loading ? "Acquiring GPS…" : "Waiting for GPS — allow location access"}
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs">Wi-Fi SSID (if site requires it)</Label>
              <Input
                value={wifiSsid}
                onChange={(e) => setWifiSsid(e.target.value)}
                placeholder="HOPE-CORP"
              />
            </div>
            <div>
              <Label className="text-xs">QR checkpoint token (if required)</Label>
              <Input
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                placeholder="Scan rotating QR at entrance"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="field"
                type="checkbox"
                checked={isField}
                onChange={(e) => setIsField(e.target.checked)}
              />
              <Label htmlFor="field" className="text-sm font-normal">
                Field work (must have active field assignment)
              </Label>
            </div>
            {isField && (
              <div>
                <Label className="text-xs">Project / work order</Label>
                <Input
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                disabled={busy || (!canClockIn && !isField)}
                onClick={() => clock("clock_in")}
              >
                <LogIn className="h-4 w-4 mr-1" /> Clock In
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                disabled={busy}
                onClick={() => clock("clock_out")}
              >
                <LogOut className="h-4 w-4 mr-1" /> Clock Out
              </Button>
            </div>
            {!canClockIn && !isField && nearest && (
              <p className="text-xs text-destructive">
                Move inside an authorized geofence to clock in, or use field work if assigned.
              </p>
            )}
            {lastResult && (
              <p className="text-sm text-muted-foreground border-t pt-2">{lastResult}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">How real attendance works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <ol className="list-decimal pl-4 space-y-1.5">
              <li>
                Admin goes <strong>onsite</strong> and opens{" "}
                <Link href="/dashboard/attendance/locations" className="underline text-foreground">
                  Attendance Locations
                </Link>
                .
              </li>
              <li>
                Taps <strong>Use live GPS here</strong> at the gate, sets radius (e.g. 80 m), saves.
              </li>
              <li>A matching geofence is created automatically for clock enforcement.</li>
              <li>
                Employees open this page; GPS must place them <strong>inside</strong> that circle.
              </li>
              <li>Successful punch updates attendance history, live board, and audit log.</li>
            </ol>
            <p className="pt-2 text-xs">
              Spoofed/mock GPS, duplicates, and out-of-fence attempts are rejected and logged under
              Fraud Violations.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
