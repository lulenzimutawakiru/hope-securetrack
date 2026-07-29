"use client";

import { useEffect, useState } from "react";
import { Fingerprint, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

type Row = {
  id: string;
  modality: string;
  device_name: string | null;
  enrollment_status: string;
  enrolled_at: string | null;
  last_verified_at: string | null;
  template_ref: string | null;
  notes: string | null;
  wid_identities?: { full_name: string; identity_number: string } | null;
};

/** Enrollment status only — never store raw biometric templates in ERP */
export default function BiometricsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Row[]>([]);
  const [identities, setIdentities] = useState<Array<{ id: string; full_name: string; identity_number: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    identity_id: "",
    modality: "fingerprint",
    device_name: "ZKTeco Terminal",
    enrollment_status: "enrolled",
    template_ref: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: ids }] = await Promise.all([
      supabase
        .from("wid_biometric_enrollments")
        .select("*, wid_identities(full_name,identity_number)")
        .order("created_at", { ascending: false }),
      supabase.from("wid_identities").select("id,full_name,identity_number").is("deleted_at", null).limit(200),
    ]);
    setRows((data as Row[]) ?? []);
    setIdentities(ids ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id || !form.identity_id) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("wid_biometric_enrollments").insert({
        company_id: auth.profile.company_id,
        identity_id: form.identity_id,
        modality: form.modality,
        device_name: form.device_name || null,
        enrollment_status: form.enrollment_status,
        template_ref: form.template_ref || `EXT-${Date.now().toString(36).toUpperCase()}`,
        enrolled_at: form.enrollment_status === "enrolled" ? new Date().toISOString() : null,
        enrolled_by: auth.profile.id,
        notes: "Status-only record. Raw biometric data remains on device / approved vault.",
      });
      if (error) throw error;
      toast.success("Enrollment status recorded (no raw biometrics stored)");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const revoke = async (id: string) => {
    const supabase = createClient();
    await supabase
      .from("wid_biometric_enrollments")
      .update({ enrollment_status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Enrollment revoked");
    await load();
  };

  if (loading) return <LoadingState message="Loading biometrics…" />;

  return (
    <div>
      <PageHeader
        title="Biometric Identity"
        description="Fingerprint · face · iris · palm — enrollment status & device refs only (no raw templates in ERP)"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Record enrollment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Biometric enrollment status</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
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
                  <Label>Modality</Label>
                  <Select value={form.modality} onValueChange={(v) => setForm((f) => ({ ...f, modality: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["fingerprint", "face", "iris", "palm"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Device</Label>
                  <Input value={form.device_name} onChange={(e) => setForm((f) => ({ ...f, device_name: e.target.value }))} />
                </div>
                <div>
                  <Label>External template ref</Label>
                  <Input value={form.template_ref} onChange={(e) => setForm((f) => ({ ...f, template_ref: e.target.value }))} placeholder="Device-side reference only" />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.enrollment_status} onValueChange={(v) => setForm((f) => ({ ...f, enrollment_status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pending", "enrolled", "failed", "expired", "revoked"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Records" value={String(rows.length)} icon={Fingerprint} />
        <StatCard title="Enrolled" value={String(rows.filter((r) => r.enrollment_status === "enrolled").length)} icon={Fingerprint} />
        <StatCard title="Revoked" value={String(rows.filter((r) => r.enrollment_status === "revoked").length)} icon={Fingerprint} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No enrollments" description="Record device enrollment status after capturing on approved hardware." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identity</TableHead>
                <TableHead>Modality</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>External ref</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div>{r.wid_identities?.full_name}</div>
                    <div className="text-xs font-mono text-muted-foreground">{r.wid_identities?.identity_number}</div>
                  </TableCell>
                  <TableCell>{r.modality}</TableCell>
                  <TableCell className="text-xs">{r.device_name || "—"}</TableCell>
                  <TableCell><StatusBadge status={r.enrollment_status} /></TableCell>
                  <TableCell className="font-mono text-xs">{r.template_ref || "—"}</TableCell>
                  <TableCell className="text-xs">{r.enrolled_at ? new Date(r.enrolled_at).toLocaleString() : "—"}</TableCell>
                  <TableCell>
                    {r.enrollment_status === "enrolled" && (
                      <Button size="sm" variant="outline" onClick={() => revoke(r.id)}>Revoke</Button>
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
