"use client";

import { useEffect, useState } from "react";
import { Gift, Plus, Check } from "lucide-react";
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
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { BONUS_TYPES, nextPayCode } from "@/lib/payroll";

export default function PayBonusesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [employees, setEmployees] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    name: "",
    bonus_type: "performance",
    amount: "",
    department: "",
    period_label: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data }, { data: emps }] = await Promise.all([
      sb.from("pay_bonuses").select("*, employees(first_name,last_name)").is("deleted_at", null).order("created_at", { ascending: false }),
      sb.from("employees").select("id,first_name,last_name,employee_number").eq("status", "active"),
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
    if (!companyId) return;
    try {
      const bonus_number = await nextPayCode(companyId, "pay_bonuses", "BN");
      const { error } = await createClient().from("pay_bonuses").insert({
        company_id: companyId,
        bonus_number,
        employee_id: form.employee_id || null,
        name: form.name,
        bonus_type: form.bonus_type,
        amount: Number(form.amount) || 0,
        department: form.department || null,
        period_label: form.period_label || null,
        status: "pending",
        created_by: auth?.user?.id,
      });
      if (error) throw error;
      toast.success("Bonus created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const approve = async (id: string) => {
    const { error } = await createClient()
      .from("pay_bonuses")
      .update({ status: "approved", approved_by: auth?.user?.id, approved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Bonus approved for next payroll");
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading bonuses…" />;

  return (
    <div>
      <PageHeader
        title="Bonuses & Incentives"
        description="Performance · production · sales commission · department rewards"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New bonus</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Create bonus</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Employee (optional for dept bonus)</Label>
                    <Select value={form.employee_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Department / pool —</SelectItem>
                        {employees.map((e) => (
                          <SelectItem key={String(e.id)} value={String(e.id)}>
                            {String(e.first_name)} {String(e.last_name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Type</Label>
                      <Select value={form.bonus_type} onValueChange={(v) => setForm((f) => ({ ...f, bonus_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BONUS_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Amount</Label>
                      <Input type="number" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Department</Label>
                      <Input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Period</Label>
                      <Input value={form.period_label} onChange={(e) => setForm((f) => ({ ...f, period_label: e.target.value }))} placeholder="July 2026" />
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Gift} title="No bonuses" description="Create performance or production incentives." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Employee</TableHead>
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
                    <TableCell className="font-mono text-xs">{String(r.bonus_number)}</TableCell>
                    <TableCell className="font-medium text-sm">{String(r.name)}</TableCell>
                    <TableCell className="text-sm">
                      {emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : String(r.department || "—")}
                    </TableCell>
                    <TableCell className="capitalize text-sm">{String(r.bonus_type)}</TableCell>
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
