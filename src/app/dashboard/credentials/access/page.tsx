"use client";

import { useEffect, useState } from "react";
import { Shield, Plus, MapPin } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import type { WidAccessZone, WidAccessProfile } from "@/lib/workforce-id";

type Assignment = {
  id: string;
  status: string;
  grant_type: string;
  valid_from: string | null;
  valid_to: string | null;
  reason: string | null;
  wid_identities?: { full_name: string; identity_number: string } | null;
  wid_access_profiles?: { name: string; profile_code: string } | null;
  wid_access_zones?: { name: string; zone_code: string } | null;
};

type AccessEvent = {
  id: string;
  event_type: string;
  result: string;
  reader_name: string | null;
  occurred_at: string;
  wid_identities?: { full_name: string } | null;
  wid_access_zones?: { name: string } | null;
};

export default function AccessPage() {
  const { auth } = useUser();
  const [zones, setZones] = useState<WidAccessZone[]>([]);
  const [profiles, setProfiles] = useState<WidAccessProfile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [identities, setIdentities] = useState<Array<{ id: string; full_name: string; identity_number: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"zones" | "profiles" | "assignments" | "events">("zones");
  const [assignOpen, setAssignOpen] = useState(false);
  const [form, setForm] = useState({
    identity_id: "",
    profile_id: "",
    zone_id: "",
    grant_type: "profile",
  });

  const load = async () => {
    const supabase = createClient();
    const [z, p, a, e, i] = await Promise.all([
      supabase.from("wid_access_zones").select("*").is("deleted_at", null).order("zone_level"),
      supabase.from("wid_access_profiles").select("*").is("deleted_at", null).order("name"),
      supabase
        .from("wid_access_assignments")
        .select("*, wid_identities(full_name,identity_number), wid_access_profiles(name,profile_code), wid_access_zones(name,zone_code)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("wid_access_events")
        .select("*, wid_identities(full_name), wid_access_zones(name)")
        .order("occurred_at", { ascending: false })
        .limit(50),
      supabase.from("wid_identities").select("id,full_name,identity_number").eq("status", "active").limit(200),
    ]);
    setZones((z.data as WidAccessZone[]) ?? []);
    setProfiles((p.data as WidAccessProfile[]) ?? []);
    setAssignments((a.data as Assignment[]) ?? []);
    setEvents((e.data as AccessEvent[]) ?? []);
    setIdentities(i.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const assign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id || !form.identity_id) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("wid_access_assignments").insert({
        company_id: auth.profile.company_id,
        identity_id: form.identity_id,
        profile_id: form.grant_type === "profile" ? form.profile_id || null : null,
        zone_id: form.grant_type === "zone" ? form.zone_id || null : null,
        grant_type: form.grant_type,
        status: "active",
        reason: "Manual assignment",
        assigned_by: auth.profile.id,
      });
      if (error) throw error;
      toast.success("Access assigned");
      setAssignOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const revoke = async (id: string) => {
    const supabase = createClient();
    await supabase
      .from("wid_access_assignments")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Access revoked");
    await load();
  };

  const simulateEvent = async () => {
    if (!auth?.profile?.company_id || !identities[0] || !zones[0]) {
      toast.error("Need identity and zone");
      return;
    }
    const supabase = createClient();
    await supabase.from("wid_access_events").insert({
      company_id: auth.profile.company_id,
      identity_id: identities[0].id,
      zone_id: zones[0].id,
      event_type: "access_granted",
      result: "granted",
      reader_name: "Main Gate Reader",
      direction: "in",
    });
    toast.success("Access event logged");
    await load();
  };

  if (loading) return <LoadingState message="Loading access control…" />;

  return (
    <div>
      <PageHeader
        title="Access Control"
        description="Zones · profiles · role/dept auto-rules · time windows · events"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={simulateEvent}>Log sample event</Button>
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Assign access</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Assign access</DialogTitle></DialogHeader>
                <form onSubmit={assign} className="space-y-3">
                  <div>
                    <Label>Identity</Label>
                    <Select value={form.identity_id} onValueChange={(v) => setForm((f) => ({ ...f, identity_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {identities.map((i) => (
                          <SelectItem key={i.id} value={i.id}>{i.identity_number} · {i.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Grant type</Label>
                    <Select value={form.grant_type} onValueChange={(v) => setForm((f) => ({ ...f, grant_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="profile">Profile</SelectItem>
                        <SelectItem value="zone">Single zone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.grant_type === "profile" ? (
                    <div>
                      <Label>Profile</Label>
                      <Select value={form.profile_id} onValueChange={(v) => setForm((f) => ({ ...f, profile_id: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.profile_code} · {p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <Label>Zone</Label>
                      <Select value={form.zone_id} onValueChange={(v) => setForm((f) => ({ ...f, zone_id: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {zones.map((z) => (
                            <SelectItem key={z.id} value={z.id}>{z.zone_code} · {z.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <DialogFooter><Button type="submit">Assign</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {(["zones", "profiles", "assignments", "events"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </div>

      {tab === "zones" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((z) => (
            <Card key={z.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" style={{ color: z.color || "#0f766e" }} />
                  <CardTitle className="text-base">{z.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-mono text-xs">{z.zone_code}</p>
                <p>Level {z.zone_level}</p>
                {z.is_restricted && <Badge variant="destructive">Restricted</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "profiles" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {profiles.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-teal-700" /> {p.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p className="font-mono text-xs">{p.profile_code}</p>
                <p className="text-muted-foreground">{p.description}</p>
                <div className="flex flex-wrap gap-1">
                  {(p.zone_codes || []).map((c) => (
                    <Badge key={c} variant="outline">{c}</Badge>
                  ))}
                </div>
                <p className="text-xs">Hours: {p.time_start} – {p.time_end}</p>
                <p className="text-xs">Auto depts: {(p.auto_departments || []).join(", ") || "—"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "assignments" && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identity</TableHead>
                <TableHead>Grant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div>{a.wid_identities?.full_name}</div>
                    <div className="text-xs font-mono text-muted-foreground">{a.wid_identities?.identity_number}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {a.wid_access_profiles
                      ? `Profile: ${a.wid_access_profiles.profile_code}`
                      : a.wid_access_zones
                        ? `Zone: ${a.wid_access_zones.zone_code}`
                        : a.grant_type}
                  </TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell className="text-xs">{a.reason || "—"}</TableCell>
                  <TableCell>
                    {a.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => revoke(a.id)}>Revoke</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {tab === "events" && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Reader</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="text-xs">{new Date(ev.occurred_at).toLocaleString()}</TableCell>
                  <TableCell>{ev.wid_identities?.full_name || "—"}</TableCell>
                  <TableCell>{ev.wid_access_zones?.name || "—"}</TableCell>
                  <TableCell className="text-xs">{ev.event_type}</TableCell>
                  <TableCell><StatusBadge status={ev.result} /></TableCell>
                  <TableCell className="text-xs">{ev.reader_name || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
