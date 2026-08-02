"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapPin, Plus, Pencil, Trash2, RefreshCw, Crosshair, Navigation, CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { useLiveGps } from "@/hooks/use-live-gps";
import { createClient } from "@/lib/supabase/client";
import {
  attCreate, attUpdate, attSoftDelete, attNextNumber, distanceMeters,
} from "@/lib/attendance";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

type Loc = Record<string, unknown> & {
  id: string;
  location_code?: string;
  name?: string;
  location_type?: string;
  lat?: number;
  lng?: number;
  radius_m?: number;
  status?: string;
  max_gps_accuracy_m?: number;
  branch_name?: string;
  building?: string;
  wifi_ssids?: string;
};

const LOCATION_TYPES = [
  "hq",
  "branch",
  "factory",
  "warehouse",
  "project_site",
  "customer_site",
  "temporary",
] as const;

const emptyForm = {
  location_code: "",
  name: "",
  location_type: "branch",
  branch_name: "",
  building: "",
  department_name: "",
  lat: "",
  lng: "",
  radius_m: "80",
  max_gps_accuracy_m: "25",
  wifi_ssids: "",
  owner_name: "",
  status: "active",
  notes: "",
  require_gps: "true",
  require_wifi: "false",
};

export default function AttendanceLocationsLivePage() {
  const { auth } = useUser();
  const companyId = auth?.profile?.company_id as string | undefined;
  const gps = useLiveGps({ enableHighAccuracy: true });

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Loc[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [gpsMeta, setGpsMeta] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await createClient()
        .from("att_locations")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      setRows((data as Loc[]) || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const mapCenter = useMemo(() => {
    if (form.lat && form.lng) {
      return { lat: Number(form.lat), lng: Number(form.lng) };
    }
    if (gps.point) return { lat: gps.point.lat, lng: gps.point.lng };
    if (rows[0]?.lat != null && rows[0]?.lng != null) {
      return { lat: Number(rows[0].lat), lng: Number(rows[0].lng) };
    }
    return { lat: 0.3476, lng: 32.5825 };
  }, [form.lat, form.lng, gps.point, rows]);

  const radius = Math.max(10, Number(form.radius_m) || 80);
  // Rough OSM bbox for radius visualization (~111km per degree)
  const deg = radius / 111000;
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${
    mapCenter.lng - Math.max(deg * 3, 0.004)
  }%2C${mapCenter.lat - Math.max(deg * 2, 0.003)}%2C${
    mapCenter.lng + Math.max(deg * 3, 0.004)
  }%2C${mapCenter.lat + Math.max(deg * 2, 0.003)}&layer=mapnik&marker=${mapCenter.lat}%2C${mapCenter.lng}`;

  const applyLiveGps = () => {
    setTestResult(null);
    if (gps.point) {
      setForm((f) => ({
        ...f,
        lat: gps.point!.lat.toFixed(7),
        lng: gps.point!.lng.toFixed(7),
      }));
      setGpsMeta(
        `Live GPS · accuracy ±${gps.point.accuracy.toFixed(1)} m · ${new Date(
          gps.point.capturedAt
        ).toLocaleTimeString()}`
      );
      toast.success("Coordinates set from live GPS");
      return;
    }
    gps.capture();
  };

  useEffect(() => {
    if (!gps.point || !open) return;
    // After capture while dialog open, auto-fill once
    setForm((f) => {
      if (f.lat && f.lng) return f;
      return {
        ...f,
        lat: gps.point!.lat.toFixed(7),
        lng: gps.point!.lng.toFixed(7),
      };
    });
    setGpsMeta(
      `Live GPS · accuracy ±${gps.point.accuracy.toFixed(1)} m · ${new Date(
        gps.point.capturedAt
      ).toLocaleTimeString()}`
    );
  }, [gps.point, open]);

  const openCreate = async () => {
    let code = "";
    if (companyId) {
      code = await attNextNumber("att_locations", companyId, "LOC", "location_code");
    }
    setForm({ ...emptyForm, location_code: code });
    setEditId(null);
    setGpsMeta(null);
    setTestResult(null);
    setOpen(true);
    gps.capture();
  };

  const openEdit = (row: Loc) => {
    setForm({
      location_code: String(row.location_code || ""),
      name: String(row.name || ""),
      location_type: String(row.location_type || "branch"),
      branch_name: String(row.branch_name || ""),
      building: String(row.building || ""),
      department_name: String(row.department_name || ""),
      lat: row.lat != null ? String(row.lat) : "",
      lng: row.lng != null ? String(row.lng) : "",
      radius_m: String(row.radius_m ?? 80),
      max_gps_accuracy_m: String(row.max_gps_accuracy_m ?? 25),
      wifi_ssids: String(row.wifi_ssids || ""),
      owner_name: String(row.owner_name || ""),
      status: String(row.status || "active"),
      notes: String(row.notes || ""),
      require_gps: row.require_gps === false ? "false" : "true",
      require_wifi: row.require_wifi ? "true" : "false",
    });
    setEditId(row.id);
    setGpsMeta(null);
    setTestResult(null);
    setOpen(true);
  };

  const save = async () => {
    if (!companyId || !auth) return;
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.lat || !form.lng) {
      return toast.error("Latitude and longitude required — use Capture live GPS on site");
    }
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return toast.error("Invalid coordinates");
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return toast.error("Coordinates out of range");
    }

    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        company_id: companyId,
        location_code: form.location_code || undefined,
        name: form.name.trim(),
        location_type: form.location_type,
        branch_name: form.branch_name || null,
        building: form.building || null,
        department_name: form.department_name || null,
        lat,
        lng,
        radius_m: Number(form.radius_m) || 80,
        max_gps_accuracy_m: Number(form.max_gps_accuracy_m) || 25,
        wifi_ssids: form.wifi_ssids || null,
        owner_name: form.owner_name || null,
        status: form.status,
        notes: form.notes || null,
        require_gps: form.require_gps === "true",
        require_wifi: form.require_wifi === "true",
      };

      let locationId = editId;
      if (editId) {
        await attUpdate("att_locations", editId, payload, auth.user.id);
        toast.success("Location updated");
      } else {
        if (!payload.location_code) {
          payload.location_code = await attNextNumber(
            "att_locations",
            companyId,
            "LOC",
            "location_code"
          );
        }
        const created = await attCreate("att_locations", payload, auth.user.id);
        locationId = created.id as string;
        toast.success("Location created from live GPS");
      }

      // Keep matching geofence in sync for clock engine / map
      await syncGeofence(companyId, {
        locationId: locationId!,
        locationCode: String(payload.location_code),
        name: String(payload.name),
        lat,
        lng,
        radius_m: Number(payload.radius_m),
        actorId: auth.user.id,
      });

      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Soft-delete this attendance location?")) return;
    try {
      await attSoftDelete("att_locations", id, auth?.user.id);
      toast.success("Location deleted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const testInside = (row: Loc) => {
    const p = gps.point;
    if (!p) {
      gps.capture();
      toast.message("Capturing GPS… tap Test again when ready");
      return;
    }
    if (row.lat == null || row.lng == null) {
      toast.error("Location has no coordinates");
      return;
    }
    const d = distanceMeters(p, { lat: Number(row.lat), lng: Number(row.lng) });
    const r = Number(row.radius_m || 0);
    const inside = d <= r;
    const msg = inside
      ? `INSIDE ${row.name} · ${Math.round(d)} m (radius ${r} m) · GPS ±${p.accuracy.toFixed(0)} m`
      : `OUTSIDE ${row.name} · ${Math.round(d)} m away (need ≤ ${r} m) · GPS ±${p.accuracy.toFixed(0)} m`;
    setTestResult(msg);
    if (inside) toast.success(msg);
    else toast.error(msg);
  };

  if (loading) return <LoadingState message="Loading attendance locations…" />;

  return (
    <div>
      <PageHeader
        title="Attendance Locations"
        description="Configure authorized sites using live onsite GPS — clock-in only works inside these geofences"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => gps.capture()} disabled={gps.loading}>
              <Crosshair className="h-4 w-4 mr-1" />
              {gps.loading ? "Getting GPS…" : "Refresh my GPS"}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Add location (onsite)
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Navigation className="h-4 w-4" /> Your live position
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {gps.error && <p className="text-destructive text-xs">{gps.error}</p>}
            {gps.point ? (
              <>
                <p className="font-mono text-xs">
                  {gps.point.lat.toFixed(6)}, {gps.point.lng.toFixed(6)}
                </p>
                <p className="text-muted-foreground text-xs">
                  Accuracy ±{gps.point.accuracy.toFixed(1)} m ·{" "}
                  {new Date(gps.point.capturedAt).toLocaleTimeString()}
                </p>
                <Badge variant={gps.point.accuracy <= 25 ? "default" : "secondary"}>
                  {gps.point.accuracy <= 25 ? "Good enough for geofence setup" : "Move outdoors for better fix"}
                </Badge>
              </>
            ) : (
              <p className="text-muted-foreground text-xs">
                Stand at the entrance or gate, then capture GPS to configure the site.
              </p>
            )}
            {testResult && (
              <p className="text-xs border rounded-md p-2 bg-muted/40">{testResult}</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Map preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden aspect-[16/9] min-h-[200px] bg-muted/30">
              <iframe title="Location map" src={osmUrl} className="w-full h-full min-h-[200px] border-0" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Marker shows the site center. Radius is enforced in the clock engine (not drawn on OSM embed).
            </p>
          </CardContent>
        </Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No attendance locations"
          description="Go onsite, open Add location, capture live GPS at the gate, set radius, and save."
        />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Coordinates</TableHead>
                <TableHead>Radius</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.location_code}</TableCell>
                  <TableCell className="text-sm font-medium">{r.name}</TableCell>
                  <TableCell className="text-sm capitalize">{String(r.location_type || "").replace(/_/g, " ")}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.lat != null && r.lng != null
                      ? `${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{r.radius_m ?? "—"} m</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => testInside(r)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Test
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Edit location" : "New location — capture onsite GPS"}
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Stand at the authorized entrance. Capture live GPS to set the geofence center. Employees can only clock in inside the radius.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={applyLiveGps} disabled={gps.loading}>
                <Crosshair className="h-4 w-4 mr-1" />
                {gps.loading ? "Capturing…" : "Use live GPS here"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => gps.capture()}>
                <RefreshCw className="h-4 w-4 mr-1" /> Re-read GPS
              </Button>
            </div>
            {gpsMeta && <p className="text-[11px] font-mono text-muted-foreground">{gpsMeta}</p>}
            {gps.error && <p className="text-xs text-destructive">{gps.error}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Code</Label>
              <Input
                value={form.location_code}
                onChange={(e) => setForm({ ...form, location_code: e.target.value })}
                disabled={!!editId}
              />
            </div>
            <div>
              <Label className="text-xs">Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Main gate / Plant entrance"
              />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select
                value={form.location_type}
                onValueChange={(v) => setForm({ ...form, location_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="inactive">inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Latitude * (from GPS)</Label>
              <Input
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Longitude * (from GPS)</Label>
              <Input
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">
                Geofence radius: <strong>{form.radius_m || 80} m</strong>
              </Label>
              <input
                type="range"
                min={25}
                max={500}
                step={5}
                value={Number(form.radius_m) || 80}
                onChange={(e) => setForm({ ...form, radius_m: e.target.value })}
                className="w-full mt-1"
              />
              <p className="text-[11px] text-muted-foreground">
                25–50 m: single door · 80–120 m: building campus · 200–500 m: large plant/yard
              </p>
            </div>
            <div>
              <Label className="text-xs">Max GPS accuracy (m)</Label>
              <Input
                type="number"
                value={form.max_gps_accuracy_m}
                onChange={(e) => setForm({ ...form, max_gps_accuracy_m: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Branch</Label>
              <Input
                value={form.branch_name}
                onChange={(e) => setForm({ ...form, branch_name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Building / gate</Label>
              <Input
                value={form.building}
                onChange={(e) => setForm({ ...form, building: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Wi-Fi SSIDs (optional, comma)</Label>
              <Input
                value={form.wifi_ssids}
                onChange={(e) => setForm({ ...form, wifi_ssids: e.target.value })}
                placeholder="HOPE-CORP,HOPE-GUEST"
              />
            </div>
            <div>
              <Label className="text-xs">Require GPS</Label>
              <Select
                value={form.require_gps}
                onValueChange={(v) => setForm({ ...form, require_gps: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Require Wi-Fi</Label>
              <Select
                value={form.require_wifi}
                onValueChange={(v) => setForm({ ...form, require_wifi: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">No</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Captured at north gate 2026-07-29"
              />
            </div>
          </div>

          {form.lat && form.lng && (
            <div className="rounded-md border overflow-hidden h-40">
              <iframe title="Form map" src={osmUrl} className="w-full h-full border-0" />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save location & geofence"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function syncGeofence(
  companyId: string,
  input: {
    locationId: string;
    locationCode: string;
    name: string;
    lat: number;
    lng: number;
    radius_m: number;
    actorId?: string;
  }
) {
  const sb = createClient();
  const fenceCode = `GF-${input.locationCode}`.slice(0, 50);
  const { data: existing } = await sb
    .from("att_geofences")
    .select("id")
    .eq("company_id", companyId)
    .eq("fence_code", fenceCode)
    .is("deleted_at", null)
    .maybeSingle();

  const payload = {
    company_id: companyId,
    fence_code: fenceCode,
    name: `${input.name} Fence`,
    location_id: input.locationId,
    location_code: input.locationCode,
    center_lat: input.lat,
    center_lng: input.lng,
    radius_m: input.radius_m,
    status: "active",
  };

  if (existing?.id) {
    const crudRes2 = await crudUpdate("att_geofences", existing.id, payload);
  } else {
    const crudRes = await crudCreate("att_geofences", payload);
  }
}
