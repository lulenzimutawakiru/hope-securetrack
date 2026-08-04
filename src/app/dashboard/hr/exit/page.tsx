"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, Plus } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

const EXIT_TYPES = [
  "resignation",
  "retirement",
  "contract_expiry",
  "termination",
  "redundancy",
];

export default function ExitPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; last_name: string; employee_number: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    exit_type: "resignation",
    last_working_day: "",
    reason: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: e }] = await Promise.all([
      supabase
        .from("employee_exits")
        .select("*, employees(first_name,last_name,employee_number)")
        .order("created_at", { ascending: false }),
      supabase
        .from("employees")
        .select("id,first_name,last_name,employee_number")
        .eq("status", "active")
        .order("last_name"),
    ]);
    setRows(data ?? []);
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
    const num = `EXIT-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const crudRes3 = await crudCreate("employee_exits", {
      company_id: auth.profile.company_id,
      exit_number: num,
      employee_id: form.employee_id,
      exit_type: form.exit_type,
      notice_date: new Date().toISOString().slice(0, 10),
      last_working_day: form.last_working_day || null,
      reason: form.reason || null,
      status: "initiated",
      processed_by: auth.profile.id,
    });
    if (!crudRes3.ok) toast.error(crudRes3.error);
    else {
      toast.success(`Exit ${num} opened`);
      setOpen(false);
      load();
    }
  };

  const updateClearance = async (
    id: string,
    field: "assets_cleared" | "payroll_cleared" | "access_revoked",
    value: boolean
  ) => {
    const supabase = createClient();
    const patch: Record<string, unknown> = { [field]: value };
    const row = rows.find((r) => r.id === id);
    const next = {
      assets_cleared: field === "assets_cleared" ? value : Boolean(row?.assets_cleared),
      payroll_cleared: field === "payroll_cleared" ? value : Boolean(row?.payroll_cleared),
      access_revoked: field === "access_revoked" ? value : Boolean(row?.access_revoked),
    };
    if (next.assets_cleared && next.payroll_cleared && next.access_revoked) {
      patch.status = "completed";
      // Terminate employee
      if (row?.employee_id) {
        const crudRes2 = await crudUpdate("employees", row.employee_id as string, { status: "terminated", end_date: new Date().toISOString().slice(0, 10) });
      }
    } else {
      patch.status = "in_progress";
    }
    const crudRes = await crudUpdate("employee_exits", id, patch);
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Clearance updated");
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Exit Management"
        description="Resignation · retirement · termination · clearance · final settlement"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/hr">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Initiate exit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>Employee exit</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-1">
                    <Label>Employee</Label>
                    <Select
                      value={form.employee_id}
                      onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.employee_number} — {e.first_name} {e.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select
                      value={form.exit_type}
                      onValueChange={(v) => setForm((f) => ({ ...f, exit_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXIT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Last working day</Label>
                    <Input
                      type="date"
                      value={form.last_working_day}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, last_working_day: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Reason</Label>
                    <Input
                      value={form.reason}
                      onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Start process</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={LogOut} title="No exit cases" description="Initiate resignation or separation" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exit #</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Last day</TableHead>
                <TableHead>Assets</TableHead>
                <TableHead>Payroll</TableHead>
                <TableHead>Access</TableHead>
                <TableHead className="text-right">Settlement</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const emp = r.employees as {
                  first_name?: string;
                  last_name?: string;
                  employee_number?: string;
                } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.exit_number)}
                    </TableCell>
                    <TableCell>
                      {emp?.employee_number} {emp?.first_name} {emp?.last_name}
                    </TableCell>
                    <TableCell className="capitalize">
                      {String(r.exit_type).replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      {r.last_working_day
                        ? formatDate(String(r.last_working_day))
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={Boolean(r.assets_cleared)}
                        onCheckedChange={(c) =>
                          updateClearance(String(r.id), "assets_cleared", Boolean(c))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={Boolean(r.payroll_cleared)}
                        onCheckedChange={(c) =>
                          updateClearance(String(r.id), "payroll_cleared", Boolean(c))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={Boolean(r.access_revoked)}
                        onCheckedChange={(c) =>
                          updateClearance(String(r.id), "access_revoked", Boolean(c))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.final_settlement || 0))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
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
