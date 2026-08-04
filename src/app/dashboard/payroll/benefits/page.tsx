"use client";

import { useEffect, useState } from "react";
import { Heart, Plus } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { apiPost } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function PayBenefitsPage() {
  const [plans, setPlans] = useState<Array<Record<string, unknown>>>([]);
  const [enrollments, setEnrollments] = useState<Array<Record<string, unknown>>>([]);
  const [employees, setEmployees] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [form, setForm] = useState({
    plan_code: "",
    name: "",
    benefit_type: "medical",
    employee_contribution: "",
    employer_contribution: "",
  });
  const [enroll, setEnroll] = useState({ employee_id: "", plan_id: "" });

  const load = async () => {
    const sb = createClient();
    const [{ data: p }, { data: e }, { data: emps }] = await Promise.all([
      sb.from("pay_benefit_plans").select("*").order("plan_code"),
      sb.from("pay_employee_benefits").select("*, employees(first_name,last_name), pay_benefit_plans(name,benefit_type)").order("created_at", { ascending: false }),
      sb.from("employees").select("id,first_name,last_name").eq("status", "active"),
    ]);
    setPlans((p as Array<Record<string, unknown>>) || []);
    setEnrollments((e as Array<Record<string, unknown>>) || []);
    setEmployees((emps as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiPost("/api/payroll/benefits", {
      entity: "plan",
      plan_code: form.plan_code.toUpperCase(),
      name: form.name,
      benefit_type: form.benefit_type,
      employee_contribution: Number(form.employee_contribution) || 0,
      employer_contribution: Number(form.employer_contribution) || 0,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Benefit plan created");
      setOpen(false);
      await load();
    }
  };

  const enrollEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enroll.employee_id || !enroll.plan_id) return;
    const res = await apiPost("/api/payroll/benefits", {
      entity: "enrollment",
      employee_id: enroll.employee_id,
      plan_id: enroll.plan_id,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Employee enrolled");
      setEnrollOpen(false);
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading benefits…" />;

  return (
    <div>
      <PageHeader
        title="Benefits Management"
        description="Medical · life · pension · transport · employer & employee contributions"
        actions={
          <div className="flex gap-2">
            <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">Enroll employee</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={enrollEmployee}>
                  <DialogHeader><DialogTitle>Enroll in benefit plan</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Employee</Label>
                      <Select value={enroll.employee_id} onValueChange={(v) => setEnroll((f) => ({ ...f, employee_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {employees.map((e) => (
                            <SelectItem key={String(e.id)} value={String(e.id)}>
                              {String(e.first_name)} {String(e.last_name)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Plan</Label>
                      <Select value={enroll.plan_id} onValueChange={(v) => setEnroll((f) => ({ ...f, plan_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {plans.map((p) => (
                            <SelectItem key={String(p.id)} value={String(p.id)}>{String(p.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Enroll</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New plan</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createPlan}>
                  <DialogHeader><DialogTitle>Benefit plan</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Code</Label>
                        <Input required value={form.plan_code} onChange={(e) => setForm((f) => ({ ...f, plan_code: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Type</Label>
                        <Select value={form.benefit_type} onValueChange={(v) => setForm((f) => ({ ...f, benefit_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="medical">Medical</SelectItem>
                            <SelectItem value="life">Life</SelectItem>
                            <SelectItem value="pension">Pension</SelectItem>
                            <SelectItem value="transport">Transport</SelectItem>
                            <SelectItem value="housing">Housing</SelectItem>
                            <SelectItem value="education">Education</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Employee contribution</Label>
                        <Input type="number" value={form.employee_contribution} onChange={(e) => setForm((f) => ({ ...f, employee_contribution: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Employer contribution</Label>
                        <Input type="number" value={form.employer_contribution} onChange={(e) => setForm((f) => ({ ...f, employer_contribution: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {plans.map((p) => (
          <Card key={String(p.id)}>
            <CardHeader className="pb-2">
              <div className="flex justify-between">
                <CardTitle className="text-base">{String(p.name)}</CardTitle>
                <Badge variant="outline" className="capitalize">{String(p.benefit_type)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-mono text-xs text-muted-foreground">{String(p.plan_code)}</p>
              <div className="flex justify-between"><span>Employee</span><span>{formatNumber(Number(p.employee_contribution))}</span></div>
              <div className="flex justify-between"><span>Employer</span><span>{formatNumber(Number(p.employer_contribution))}</span></div>
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && (
          <EmptyState icon={Heart} title="No benefit plans" description="Create medical, life, or pension plans." />
        )}
      </div>

      <h3 className="font-medium mb-2 text-sm">Enrollments</h3>
      {enrollments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No enrollments yet.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">EE</TableHead>
                <TableHead className="text-right">ER</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((r) => {
                const emp = r.employees as { first_name?: string; last_name?: string } | null;
                const plan = r.pay_benefit_plans as { name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="text-sm">
                      {emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{plan?.name || "—"}</TableCell>
                    <TableCell className="text-right">{formatNumber(Number(r.employee_amount))}</TableCell>
                    <TableCell className="text-right">{formatNumber(Number(r.employer_amount))}</TableCell>
                    <TableCell className="capitalize">{String(r.status)}</TableCell>
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
