"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
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
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { crudCreate } from "@/lib/api/crud-client";
import { apiPost } from "@/lib/api-client";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

const LEAVE_TYPES = [
  "annual",
  "sick",
  "maternity",
  "paternity",
  "compassionate",
  "study",
  "unpaid",
];

export default function LeavePage() {
  const [leave, setLeave] = useState<Array<Record<string, unknown>>>([]);
  const [balances, setBalances] = useState<Array<Record<string, unknown>>>([]);
  const [holidays, setHolidays] = useState<Array<Record<string, unknown>>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; last_name: string; employee_number: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    leave_type: "annual",
    start_date: "",
    end_date: "",
    reason: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: l }, { data: b }, { data: h }, { data: e }] = await Promise.all([
      supabase
        .from("leave_requests")
        .select("*, employees(first_name,last_name,employee_number)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("leave_balances")
        .select("*, employees(first_name,last_name,employee_number)")
        .eq("year", new Date().getFullYear())
        .limit(100),
      supabase
        .from("public_holidays")
        .select("*")
        .gte("holiday_date", new Date().toISOString().slice(0, 10))
        .order("holiday_date")
        .limit(12),
      supabase
        .from("employees")
        .select("id,first_name,last_name,employee_number")
        .eq("status", "active")
        .order("last_name"),
    ]);
    setLeave(l ?? []);
    setBalances(b ?? []);
    setHolidays(h ?? []);
    setEmployees(e ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    const days = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    );
    const res = await crudCreate("leave_requests", {
      employee_id: form.employee_id,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      days,
      reason: form.reason || null,
      status: "pending",
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Leave submitted");
      setOpen(false);
      load();
    }
  };

  const decide = async (id: string, status: string) => {
    const res = await apiPost(`/api/hr/leave/${id}/approve`, { status });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`Leave ${status}`);
      load();
    }
  };

  if (loading) return <LoadingState />;

  const pending = leave.filter((l) => l.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="Leave Management"
        description="Annual · sick · maternity · calendar · balances · approval workflow"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/hr">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Request leave
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>Leave request</DialogTitle>
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
                      value={form.leave_type}
                      onValueChange={(v) => setForm((f) => ({ ...f, leave_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAVE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Start</Label>
                      <Input
                        type="date"
                        value={form.start_date}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, start_date: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>End</Label>
                      <Input
                        type="date"
                        value={form.end_date}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, end_date: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Reason</Label>
                    <Input
                      value={form.reason}
                      onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Submit</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Requests" value={formatNumber(leave.length)} icon={CalendarDays} />
        <StatCard title="Pending approvals" value={formatNumber(pending)} />
        <StatCard title="Upcoming holidays" value={formatNumber(holidays.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <div className="lg:col-span-2">
          {leave.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No leave requests" description="Submit a request" />
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leave.map((l) => {
                    const emp = l.employees as {
                      first_name?: string;
                      last_name?: string;
                      employee_number?: string;
                    } | null;
                    return (
                      <TableRow key={String(l.id)}>
                        <TableCell>
                          {emp?.employee_number} {emp?.first_name} {emp?.last_name}
                        </TableCell>
                        <TableCell className="capitalize">
                          {String(l.leave_type)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(String(l.start_date))} →{" "}
                          {formatDate(String(l.end_date))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(Number(l.days))}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={String(l.status)} />
                        </TableCell>
                        <TableCell className="space-x-1">
                          {l.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => decide(String(l.id), "approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => decide(String(l.id), "rejected")}
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

        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2 text-sm">Leave balances (YTD)</h3>
            <div className="rounded-lg border overflow-x-auto max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Bal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.slice(0, 20).map((b) => {
                    const emp = b.employees as {
                      first_name?: string;
                      last_name?: string;
                    } | null;
                    return (
                      <TableRow key={String(b.id)}>
                        <TableCell className="text-sm">
                          {emp?.first_name} {emp?.last_name}
                        </TableCell>
                        <TableCell className="capitalize text-sm">
                          {String(b.leave_type)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(Number(b.balance))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2 text-sm">Public holidays</h3>
            <ul className="text-sm space-y-1 rounded border p-3">
              {holidays.map((h) => (
                <li key={String(h.id)} className="flex justify-between gap-2">
                  <span>{String(h.name)}</span>
                  <span className="text-muted-foreground">
                    {formatDate(String(h.holiday_date))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
