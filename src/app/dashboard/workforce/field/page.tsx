"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function FieldWorkforcePage() {
  const { auth } = useUser();
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    customer_name: "",
    address: "",
    assigned_to: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: e }] = await Promise.all([
      supabase
        .from("field_jobs")
        .select("*, employees(first_name,last_name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("employees").select("id,first_name,last_name").eq("status", "active"),
    ]);
    setJobs(data ?? []);
    setEmployees(e ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const num = `FJ-${Date.now().toString(36).toUpperCase()}`;
    const crudRes2 = await crudCreate("field_jobs", {
      company_id: auth.profile.company_id,
      job_number: num,
      title: form.title,
      customer_name: form.customer_name || null,
      address: form.address || null,
      assigned_to: form.assigned_to || null,
      status: "assigned",
      scheduled_start: new Date().toISOString(),
      created_by: auth.profile.id,
    });
    if (!crudRes2.ok) toast.error(crudRes2.error);
    else {
      toast.success(`Field job ${num} created`);
      setOpen(false);
      load();
    }
  };

  const setStatus = async (id: string, status: string) => {
    const supabase = createClient();
    const updates: Record<string, unknown> = { status };
    if (status === "on_site") {
      updates.check_in_at = new Date().toISOString();
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 })
        );
        updates.gps_lat = pos.coords.latitude;
        updates.gps_lng = pos.coords.longitude;
      } catch {
        /* optional */
      }
    }
    if (status === "completed") updates.check_out_at = new Date().toISOString();
    const crudRes = await crudUpdate("field_jobs", id, updates);
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Job updated");
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Field Workforce"
        description="Engineers & technicians — job assignment, GPS check-in, mobile work orders"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New field job
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader>
                  <DialogTitle>Assign field job</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      required
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Press service / site survey"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    <Input
                      value={form.customer_name}
                      onChange={(e) =>
                        setForm({ ...form, customer_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assign to</Label>
                    <Select
                      value={form.assigned_to}
                      onValueChange={(v) => setForm({ ...form, assigned_to: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Technician" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.first_name} {e.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {jobs.length === 0 ? (
        <EmptyState icon={MapPin} title="No field jobs" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => {
                const emp = j.employees as {
                  first_name: string;
                  last_name: string;
                } | null;
                return (
                  <TableRow key={String(j.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(j.job_number)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{String(j.title)}</div>
                      {j.scheduled_start != null ? (
                        <div className="text-[10px] text-muted-foreground">
                          {formatDateTime(String(j.scheduled_start))}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {emp ? `${emp.first_name} ${emp.last_name}` : "—"}
                    </TableCell>
                    <TableCell>{String(j.customer_name || "—")}</TableCell>
                    <TableCell>
                      <StatusBadge status={String(j.status)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={String(j.status)}
                        onValueChange={(v) => setStatus(String(j.id), v)}
                      >
                        <SelectTrigger className="w-[130px] ml-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "assigned",
                            "en_route",
                            "on_site",
                            "completed",
                            "cancelled",
                          ].map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">
                              {s.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
