"use client";

import { useEffect, useState } from "react";
import { Landmark, Plus, Check } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";
import { LOAN_TYPES } from "@/lib/payroll";

export default function PayLoansPage() {
  const { auth } = useUser();
  const [loans, setLoans] = useState<Array<Record<string, unknown>>>([]);
  const [advances, setAdvances] = useState<Array<Record<string, unknown>>>([]);
  const [employees, setEmployees] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [openLoan, setOpenLoan] = useState(false);
  const [openAdv, setOpenAdv] = useState(false);
  const [loanForm, setLoanForm] = useState({
    employee_id: "",
    loan_type: "emergency",
    principal: "",
    interest_rate_pct: "0",
    installments: "6",
    notes: "",
  });
  const [advForm, setAdvForm] = useState({
    employee_id: "",
    amount: "",
    reason: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data: l }, { data: a }, { data: emps }] = await Promise.all([
      sb.from("pay_loans").select("*, employees(first_name,last_name)").is("deleted_at", null).order("created_at", { ascending: false }),
      sb.from("pay_advances").select("*, employees(first_name,last_name)").is("deleted_at", null).order("created_at", { ascending: false }),
      sb.from("employees").select("id,first_name,last_name,employee_number").eq("status", "active"),
    ]);
    setLoans((l as Array<Record<string, unknown>>) || []);
    setAdvances((a as Array<Record<string, unknown>>) || []);
    setEmployees((emps as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const submitLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !loanForm.employee_id) return;
    try {
      const res = await apiPost("/api/payroll/loans", {
        employee_id: loanForm.employee_id,
        loan_type: loanForm.loan_type,
        principal: Number(loanForm.principal) || 0,
        interest_rate_pct: Number(loanForm.interest_rate_pct) || 0,
        installments: Number(loanForm.installments) || 1,
        notes: loanForm.notes,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Loan application submitted");
      setOpenLoan(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const submitAdv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !advForm.employee_id) return;
    try {
      const res = await apiPost("/api/payroll/advances", {
        employee_id: advForm.employee_id,
        amount: Number(advForm.amount) || 0,
        reason: advForm.reason,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Advance requested");
      setOpenAdv(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const doApproveLoan = async (id: string) => {
    if (!auth?.user?.id) return;
    try {
      const res = await apiPost(`/api/payroll/loans/${encodeURIComponent(id)}/approve`, {
        approve: true,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Loan approved · schedule generated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const approveAdv = async (id: string) => {
    try {
      const res = await apiPost(`/api/payroll/advances/${encodeURIComponent(id)}/approve`, {
        approve: true,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Advance approved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading loans & advances…" />;

  const empName = (r: Record<string, unknown>) => {
    const emp = r.employees as { first_name?: string; last_name?: string } | null;
    return emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : "—";
  };

  return (
    <div>
      <PageHeader
        title="Loans & Advances"
        description="Applications · approval · installments · payroll recovery"
        actions={
          <div className="flex gap-2">
            <Dialog open={openAdv} onOpenChange={setOpenAdv}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Advance</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submitAdv}>
                  <DialogHeader><DialogTitle>Salary advance</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Employee</Label>
                      <Select value={advForm.employee_id} onValueChange={(v) => setAdvForm((f) => ({ ...f, employee_id: v }))}>
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
                      <Label>Amount</Label>
                      <Input type="number" required value={advForm.amount} onChange={(e) => setAdvForm((f) => ({ ...f, amount: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Reason</Label>
                      <Input value={advForm.reason} onChange={(e) => setAdvForm((f) => ({ ...f, reason: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Submit</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={openLoan} onOpenChange={setOpenLoan}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Loan</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submitLoan}>
                  <DialogHeader><DialogTitle>Employee loan</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Employee</Label>
                      <Select value={loanForm.employee_id} onValueChange={(v) => setLoanForm((f) => ({ ...f, employee_id: v }))}>
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
                      <Label>Type</Label>
                      <Select value={loanForm.loan_type} onValueChange={(v) => setLoanForm((f) => ({ ...f, loan_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LOAN_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>Principal</Label>
                        <Input type="number" required value={loanForm.principal} onChange={(e) => setLoanForm((f) => ({ ...f, principal: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Interest %</Label>
                        <Input type="number" value={loanForm.interest_rate_pct} onChange={(e) => setLoanForm((f) => ({ ...f, interest_rate_pct: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Installments</Label>
                        <Input type="number" value={loanForm.installments} onChange={(e) => setLoanForm((f) => ({ ...f, installments: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Submit</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Tabs defaultValue="loans">
        <TabsList>
          <TabsTrigger value="loans">Loans ({loans.length})</TabsTrigger>
          <TabsTrigger value="advances">Advances ({advances.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="loans">
          {loans.length === 0 ? (
            <EmptyState icon={Landmark} title="No loans" description="Create multi-installment employee loans." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Installment</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((r) => (
                    <TableRow key={String(r.id)}>
                      <TableCell className="font-mono text-xs">{String(r.loan_number)}</TableCell>
                      <TableCell className="text-sm">{empName(r)}</TableCell>
                      <TableCell className="capitalize text-sm">{String(r.loan_type).replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-right">{formatNumber(Number(r.principal))}</TableCell>
                      <TableCell className="text-right">{formatNumber(Number(r.installment_amount))}</TableCell>
                      <TableCell className="text-right">{formatNumber(Number(r.outstanding))}</TableCell>
                      <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                      <TableCell>
                        {r.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => doApproveLoan(String(r.id))}>
                            <Check className="h-3 w-3 mr-1" /> Approve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="advances">
          {advances.length === 0 ? (
            <EmptyState icon={Landmark} title="No advances" description="Employees can request salary advances." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.map((r) => (
                    <TableRow key={String(r.id)}>
                      <TableCell className="font-mono text-xs">{String(r.advance_number)}</TableCell>
                      <TableCell className="text-sm">{empName(r)}</TableCell>
                      <TableCell className="text-right">{formatNumber(Number(r.amount))}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{String(r.reason || "—")}</TableCell>
                      <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                      <TableCell>
                        {r.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => approveAdv(String(r.id))}>
                            <Check className="h-3 w-3 mr-1" /> Approve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
