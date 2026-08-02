"use client";

import { useEffect, useState } from "react";
import { Users, Plus, CalendarDays } from "lucide-react";
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

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  job_title: string | null;
  status: string;
  hire_date: string | null;
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  reason: string | null;
  employees?: { first_name: string; last_name: string; employee_number: string } | null;
}

export default function HrEmployeesPage() {
  const [tab, setTab] = useState<"employees" | "leave">("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [empOpen, setEmpOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [empForm, setEmpForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    department: "Production",
    job_title: "",
    employee_number: "",
    hire_date: new Date().toISOString().slice(0, 10),
  });
  const [leaveForm, setLeaveForm] = useState({
    employee_id: "",
    leave_type: "annual",
    start_date: "",
    end_date: "",
    reason: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: e }, { data: l }] = await Promise.all([
      supabase.from("employees").select("*").order("last_name"),
      supabase
        .from("leave_requests")
        .select("*, employees(first_name,last_name,employee_number)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setEmployees((e as Employee[]) ?? []);
    setLeave((l as LeaveRequest[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const num =
        empForm.employee_number ||
        `EMP-${String(employees.length + 1).padStart(4, "0")}`;
      const res = await crudCreate("employees", {
        employee_number: num,
        first_name: empForm.first_name,
        last_name: empForm.last_name,
        email: empForm.email || null,
        phone: empForm.phone || null,
        department: empForm.department || null,
        job_title: empForm.job_title || null,
        hire_date: empForm.hire_date || null,
        status: "active",
        employment_type: "permanent",
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Employee added");
      setEmpOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const createLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const start = new Date(leaveForm.start_date);
      const end = new Date(leaveForm.end_date);
      const days =
        Math.max(
          1,
          Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
        );
      const res = await crudCreate("leave_requests", {
        employee_id: leaveForm.employee_id,
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        days,
        reason: leaveForm.reason || null,
        status: "pending",
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Leave request submitted");
      setLeaveOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const approveLeave = async (id: string, status: "approved" | "rejected") => {
    const res = await apiPost(`/api/hr/leave/${id}/approve`, { status });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`Leave ${status}`);
      load();
    }
  };

  if (loading) return <LoadingState />;

  const active = employees.filter((e) => e.status === "active").length;
  const pendingLeave = leave.filter((l) => l.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="Employee Directory"
        description="Master records · departments · grades · contracts · leave snapshot"
        actions={
          <div className="flex gap-2">
            <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <CalendarDays className="mr-2 h-4 w-4" /> Leave request
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createLeave}>
                  <DialogHeader>
                    <DialogTitle>Leave request</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-4">
                    <div className="space-y-2">
                      <Label>Employee</Label>
                      <Select
                        value={leaveForm.employee_id}
                        onValueChange={(v) =>
                          setLeaveForm({ ...leaveForm, employee_id: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.first_name} {emp.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={leaveForm.leave_type}
                        onValueChange={(v) =>
                          setLeaveForm({ ...leaveForm, leave_type: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="sick">Sick</SelectItem>
                          <SelectItem value="maternity">Maternity</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Start</Label>
                        <Input
                          type="date"
                          required
                          value={leaveForm.start_date}
                          onChange={(e) =>
                            setLeaveForm({
                              ...leaveForm,
                              start_date: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End</Label>
                        <Input
                          type="date"
                          required
                          value={leaveForm.end_date}
                          onChange={(e) =>
                            setLeaveForm({
                              ...leaveForm,
                              end_date: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Reason</Label>
                      <Input
                        value={leaveForm.reason}
                        onChange={(e) =>
                          setLeaveForm({ ...leaveForm, reason: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={saving || !leaveForm.employee_id}
                    >
                      Submit
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={empOpen} onOpenChange={setEmpOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Add employee
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createEmployee}>
                  <DialogHeader>
                    <DialogTitle>New employee</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>First name</Label>
                        <Input
                          required
                          value={empForm.first_name}
                          onChange={(e) =>
                            setEmpForm({ ...empForm, first_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last name</Label>
                        <Input
                          required
                          value={empForm.last_name}
                          onChange={(e) =>
                            setEmpForm({ ...empForm, last_name: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Input
                          value={empForm.department}
                          onChange={(e) =>
                            setEmpForm({ ...empForm, department: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Job title</Label>
                        <Input
                          value={empForm.job_title}
                          onChange={(e) =>
                            setEmpForm({ ...empForm, job_title: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={empForm.email}
                        onChange={(e) =>
                          setEmpForm({ ...empForm, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={empForm.phone}
                          onChange={(e) =>
                            setEmpForm({ ...empForm, phone: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Hire date</Label>
                        <Input
                          type="date"
                          value={empForm.hire_date}
                          onChange={(e) =>
                            setEmpForm({ ...empForm, hire_date: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>
                      Save
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Employees" value={formatNumber(employees.length)} icon={Users} />
        <StatCard title="Active" value={formatNumber(active)} />
        <StatCard title="Pending leave" value={formatNumber(pendingLeave)} />
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          size="sm"
          variant={tab === "employees" ? "default" : "outline"}
          onClick={() => setTab("employees")}
        >
          Employees
        </Button>
        <Button
          size="sm"
          variant={tab === "leave" ? "default" : "outline"}
          onClick={() => setTab("leave")}
        >
          Leave
        </Button>
      </div>

      {tab === "employees" ? (
        employees.length === 0 ? (
          <EmptyState icon={Users} title="No employees yet" />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Hire date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-sm">
                      {e.employee_number}
                    </TableCell>
                    <TableCell className="font-medium">
                      {e.first_name} {e.last_name}
                      {e.email && (
                        <div className="text-xs text-muted-foreground">
                          {e.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{e.department ?? "—"}</TableCell>
                    <TableCell>{e.job_title ?? "—"}</TableCell>
                    <TableCell>
                      {e.hire_date ? formatDate(e.hire_date) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : leave.length === 0 ? (
        <EmptyState title="No leave requests" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leave.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    {l.employees
                      ? `${l.employees.first_name} ${l.employees.last_name}`
                      : "—"}
                  </TableCell>
                  <TableCell className="capitalize">{l.leave_type}</TableCell>
                  <TableCell className="text-sm">
                    {formatDate(l.start_date)} → {formatDate(l.end_date)}
                  </TableCell>
                  <TableCell>{l.days}</TableCell>
                  <TableCell>
                    <StatusBadge status={l.status} />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {l.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => approveLeave(l.id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveLeave(l.id, "rejected")}
                        >
                          Reject
                        </Button>
                      </>
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
