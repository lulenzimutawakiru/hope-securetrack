"use client";

import { useEffect, useState } from "react";
import { Plus, Timer } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function OvertimePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; last_name: string; hourly_rate: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    work_date: new Date().toISOString().slice(0, 10),
    hours: "2",
    reason: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: e }] = await Promise.all([
      supabase
        .from("overtime_requests")
        .select("*, employees(first_name,last_name,employee_number)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("employees")
        .select("id,first_name,last_name,hourly_rate")
        .eq("status", "active"),
    ]);
    setRows(data ?? []);
    setEmployees(e ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    try {
      const emp = employees.find((x) => x.id === form.employee_id);
      const hours = parseFloat(form.hours);
      const rate = Number(emp?.hourly_rate || 15000);
      const cost = hours * rate * 1.5;
      const supabase = createClient();
      const crudRes2 = await crudCreate("overtime_requests", {
        company_id: auth.profile.company_id,
        employee_id: form.employee_id,
        work_date: form.work_date,
        hours,
        rate_multiplier: 1.5,
        reason: form.reason || null,
        estimated_cost: cost,
        status: "pending",
      });
      if (!crudRes2.ok) throw new Error(crudRes2.error);
      toast.success("Overtime submitted for approval");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const decide = async (id: string, status: "approved" | "rejected") => {
    if (!auth) return;
    const supabase = createClient();
    const crudRes = await crudUpdate("overtime_requests", id, {
        status,
        approved_by: auth.profile.id,
        approved_at: new Date().toISOString(),
      });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success(`Overtime ${status}`);
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Overtime Management"
        description="Eligibility, approvals, 1.5× pay rates, compliance limits, cost estimates (UGX)"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Request OT
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={submit}>
                <DialogHeader>
                  <DialogTitle>Overtime request</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select
                      value={form.employee_id}
                      onValueChange={(v) => setForm({ ...form, employee_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={form.work_date}
                        onChange={(e) =>
                          setForm({ ...form, work_date: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hours</Label>
                      <Input
                        type="number"
                        min={0.5}
                        step={0.5}
                        max={12}
                        value={form.hours}
                        onChange={(e) =>
                          setForm({ ...form, hours: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Input
                      value={form.reason}
                      onChange={(e) =>
                        setForm({ ...form, reason: e.target.value })
                      }
                      placeholder="Production catch-up / customer rush"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving || !form.employee_id}>
                    Submit
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Timer} title="No overtime requests" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Est. cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const emp = r.employees as {
                  first_name: string;
                  last_name: string;
                } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell>
                      {emp ? `${emp.first_name} ${emp.last_name}` : "—"}
                    </TableCell>
                    <TableCell>{formatDate(String(r.work_date))}</TableCell>
                    <TableCell>{String(r.hours)}</TableCell>
                    <TableCell>
                      UGX {formatNumber(Number(r.estimated_cost || 0))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => decide(String(r.id), "approved")}>
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => decide(String(r.id), "rejected")}
                          >
                            Reject
                          </Button>
                        </>
                      )}
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
