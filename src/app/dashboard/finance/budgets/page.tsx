"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PiggyBank, Plus } from "lucide-react";
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

const TYPES = [
  "operational",
  "capital",
  "manufacturing",
  "sales",
  "hr",
  "procurement",
  "project",
  "cash",
];

export default function BudgetsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    budget_code: "",
    name: "",
    budget_type: "operational",
    total_amount: "",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("budgets")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const { error } = await supabase.from("budgets").insert({
      company_id: auth.profile.company_id,
      budget_code: form.budget_code,
      name: form.name,
      budget_type: form.budget_type,
      currency: "UGX",
      total_amount: Number(form.total_amount),
      status: "draft",
      version: 1,
      created_by: auth.profile.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Budget created");
      setOpen(false);
      load();
    }
  };

  const setStatus = async (id: string, status: string) => {
    const supabase = createClient();
    const patch: Record<string, unknown> = { status };
    if (status === "approved" && auth) {
      patch.approved_by = auth.profile.id;
      patch.approved_at = new Date().toISOString();
    }
    const { error } = await supabase.from("budgets").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Budget ${status}`);
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Budget Management"
        description="Operational · capital · manufacturing · approve · lock · revise"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/finance">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New budget
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>Create budget</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-1">
                    <Label>Code</Label>
                    <Input
                      value={form.budget_code}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, budget_code: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <Select
                        value={form.budget_type}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, budget_type: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Total amount</Label>
                      <Input
                        type="number"
                        value={form.total_amount}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, total_amount: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create draft</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={PiggyBank} title="No budgets" description="Create annual budgets" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">
                    {String(r.budget_code)}
                  </TableCell>
                  <TableCell className="font-medium">{String(r.name)}</TableCell>
                  <TableCell className="capitalize">
                    {String(r.budget_type)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.total_amount))}
                  </TableCell>
                  <TableCell>v{String(r.version)}</TableCell>
                  <TableCell>
                    <StatusBadge status={String(r.status)} />
                  </TableCell>
                  <TableCell className="space-x-1">
                    {r.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(String(r.id), "approved")}
                      >
                        Approve
                      </Button>
                    )}
                    {r.status === "approved" && (
                      <Button
                        size="sm"
                        onClick={() => setStatus(String(r.id), "locked")}
                      >
                        Lock
                      </Button>
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
