"use client";

import { useEffect, useState } from "react";
import { UserCircle, Eye, Landmark } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";

export default function PaySelfServicePage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [payslips, setPayslips] = useState<Array<Record<string, unknown>>>([]);
  const [lines, setLines] = useState<Array<Record<string, unknown>>>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      const sb = createClient();
      // Match employee by user profile email or user_id
      const email = auth?.user?.email;
      const userId = auth?.user?.id;
      let empId: string | null = null;

      if (userId) {
        const { data: byUser } = await sb
          .from("employees")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        empId = byUser?.id || null;
      }
      if (!empId && email) {
        const { data: byEmail } = await sb
          .from("employees")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        empId = byEmail?.id || null;
      }

      // Fallback: show all published payslips for demo if no employee link
      setEmployeeId(empId);

      if (empId) {
        const [{ data: ps }, { data: hist }] = await Promise.all([
          sb.from("pay_payslips").select("*").eq("employee_id", empId).eq("is_published", true).order("created_at", { ascending: false }),
          sb.from("payroll_lines").select("*, payroll_runs(period_label,run_number)").eq("employee_id", empId).order("created_at", { ascending: false }).limit(24),
        ]);
        setPayslips((ps as Array<Record<string, unknown>>) || []);
        setLines((hist as Array<Record<string, unknown>>) || []);
      } else {
        const { data: ps } = await sb
          .from("pay_payslips")
          .select("*, employees(first_name,last_name)")
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(20);
        setPayslips((ps as Array<Record<string, unknown>>) || []);
      }
      setLoading(false);
    }
    if (auth) load().catch(() => setLoading(false));
    else setLoading(false);
  }, [auth]);

  const requestAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !employeeId) {
      toast.error("Link your user account to an employee record for advances");
      return;
    }
    try {
      const res = await apiPost("/api/payroll/advances", {
        employee_id: employeeId,
        amount: Number(amount) || 0,
        reason,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Advance request submitted");
      setOpen(false);
      setAmount("");
      setReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading self-service…" />;

  return (
    <div>
      <PageHeader
        title="Payroll Self-Service"
        description="Payslips · salary history · advances · bank updates"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Landmark className="h-4 w-4 mr-1" /> Request advance</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={requestAdvance}>
                <DialogHeader><DialogTitle>Salary advance request</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Amount</Label>
                    <Input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div>
                    <Label>Reason</Label>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Submit</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {!employeeId && (
        <Card className="mb-4 border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Your login is not linked to an employee record (`employees.user_id` or matching email).
            Showing published payslips org-wide for administrators; link your profile for personal ESS.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCircle className="h-4 w-4" /> My payslips
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payslips.length === 0 ? (
              <EmptyState icon={UserCircle} title="No payslips" description="Published payslips will appear here." />
            ) : (
              <div className="space-y-2">
                {payslips.map((p) => (
                  <div key={String(p.id)} className="flex items-center justify-between border rounded p-2">
                    <div>
                      <p className="text-sm font-medium">{String(p.period_label)}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{String(p.payslip_number)}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setPreview(String(p.html_body || ""))}>
                      <Eye className="h-3 w-3 mr-1" /> View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Salary history</CardTitle>
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payroll history for linked employee.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => {
                    const run = l.payroll_runs as { period_label?: string } | null;
                    return (
                      <TableRow key={String(l.id)}>
                        <TableCell className="text-sm">{run?.period_label || "—"}</TableCell>
                        <TableCell className="text-right text-sm">{formatNumber(Number(l.gross_pay))}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatNumber(Number(l.net_pay))}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Payslip</DialogTitle></DialogHeader>
          {preview && <iframe title="Payslip" srcDoc={preview} className="w-full h-[70vh] rounded border bg-white" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
