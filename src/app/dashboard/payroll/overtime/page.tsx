"use client";

import { useEffect, useState } from "react";
import { Clock, Plus, Check } from "lucide-react";
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
import { apiPost } from "@/lib/api-client";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { OT_TYPES } from "@/lib/payroll";

export default function PayOvertimePage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [employees, setEmployees] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    work_date: new Date().toISOString().slice(0, 10),
    hours: "2",
    ot_type: "weekday",
    notes: "",
  });

  const load = async () => {
    const sb = createClient();
    const [{ data }, { data: emps }] = await Promise.all([
      sb.from("pay_overtime_claims").select("*, employees(first_name,last_name,employee_number,salary)").is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
      sb.from("employees").select("id,first_name,last_name,employee_number,salary").eq("status", "active").order("first_name"),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setEmployees((emps as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id) return;
    const res = await apiPost("/api/payroll/overtime", {
      employee_id: form.employee_id,
      work_date: form.work_date,
      hours: Number(form.hours) || 0,
      ot_type: form.ot_type,
      notes: form.notes,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("OT claim submitted");
      setOpen(false);
      await load();
    }
  };

  const approve = async (id: string) => {
    const res = await apiPost(`/api/payroll/overtime/${id}/approve`, {
      approve: true,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("OT approved");
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading overtime…" />;

  return (
    <div>
      <PageHeader
        title="Overtime Management"
        description="Weekday 1.5× · weekend/holiday 2× · night 1.75× · approval → payroll"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New claim</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Overtime claim</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Employee</Label>
                    <Select value={form.employee_id} onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {employees.map((e) => (
                          <SelectItem key={String(e.id)} value={String(e.id)}>
                            {String(e.first_name)} {String(e.last_name)} ({String(e.employee_number)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Date</Label>
                      <Input type="date" value={form.work_date} onChange={(e) => setForm((f) => ({ ...f, work_date: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Hours</Label>
                      <Input type="number" step="0.5" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.ot_type} onValueChange={(v) => setForm((f) => ({ ...f, ot_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label} ({t.multiplier}×)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Submit</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Clock} title="No OT claims" description="Submit overtime for supervisor approval." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const emp = r.employees as { first_name?: string; last_name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">{String(r.claim_number)}</TableCell>
                    <TableCell className="text-sm">
                      {emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.work_date ? formatDate(String(r.work_date)) : "—"}</TableCell>
                    <TableCell>{String(r.hours)}</TableCell>
                    <TableCell className="capitalize text-sm">{String(r.ot_type)}</TableCell>
                    <TableCell className="text-right">{formatNumber(Number(r.amount))}</TableCell>
                    <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                    <TableCell>
                      {r.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => approve(String(r.id))}>
                          <Check className="h-3 w-3 mr-1" /> Approve
                        </Button>
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
