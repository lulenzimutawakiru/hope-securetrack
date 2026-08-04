"use client";

import { useEffect, useState } from "react";
import { Plus, CalendarClock } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

interface ShiftTemplate {
  id: string;
  code: string;
  name: string;
  pattern: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  is_night: boolean;
}

interface Assignment {
  id: string;
  work_date: string;
  status: string;
  location: string | null;
  employees?: { first_name: string; last_name: string; employee_number: string } | null;
  shift_templates?: { name: string; code: string } | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
}

export default function ShiftsPage() {
  const { auth } = useUser();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    shift_template_id: "",
    work_date: new Date().toISOString().slice(0, 10),
    location: "Main Factory",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: t }, { data: a }, { data: e }] = await Promise.all([
      supabase.from("shift_templates").select("*").eq("is_active", true).order("start_time"),
      supabase
        .from("shift_assignments")
        .select("*, employees(first_name,last_name,employee_number), shift_templates(name,code)")
        .order("work_date", { ascending: false })
        .limit(100),
      supabase.from("employees").select("id,first_name,last_name,employee_number").eq("status", "active"),
    ]);
    setTemplates((t as ShiftTemplate[]) ?? []);
    setAssignments((a as Assignment[]) ?? []);
    setEmployees((e as Employee[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const assign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const crudRes = await crudCreate("shift_assignments", {
        company_id: auth.profile.company_id,
        employee_id: form.employee_id,
        shift_template_id: form.shift_template_id,
        work_date: form.work_date,
        location: form.location || null,
        status: "scheduled",
        assigned_by: auth.profile.id,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Shift assigned");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Shift Management"
        description="Fixed, rotating, night, weekend, flexible and emergency shifts for SecureTrack ERP operations"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Assign shift
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={assign}>
                <DialogHeader>
                  <DialogTitle>Assign employee to shift</DialogTitle>
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
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name} ({emp.employee_number})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Shift template</Label>
                    <Select
                      value={form.shift_template_id}
                      onValueChange={(v) =>
                        setForm({ ...form, shift_template_id: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select shift" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.start_time?.slice(0, 5)}–{t.end_time?.slice(0, 5)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.work_date}
                      onChange={(e) =>
                        setForm({ ...form, work_date: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input
                      value={form.location}
                      onChange={(e) =>
                        setForm({ ...form, location: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={
                      saving || !form.employee_id || !form.shift_template_id
                    }
                  >
                    Assign
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {templates.map((t) => (
          <div key={t.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">{t.name}</p>
              {t.is_night && <Badge variant="secondary">Night</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {t.code} · {t.pattern}
            </p>
            <p className="text-sm mt-2">
              {t.start_time?.slice(0, 5)} – {t.end_time?.slice(0, 5)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Break {t.break_minutes} min
            </p>
          </div>
        ))}
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No shift assignments"
          description="Assign employees to morning, afternoon, night or office shifts"
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{formatDate(a.work_date)}</TableCell>
                  <TableCell>
                    {a.employees
                      ? `${a.employees.first_name} ${a.employees.last_name}`
                      : "—"}
                  </TableCell>
                  <TableCell>{a.shift_templates?.name ?? "—"}</TableCell>
                  <TableCell>{a.location ?? "—"}</TableCell>
                  <TableCell className="capitalize">{a.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
