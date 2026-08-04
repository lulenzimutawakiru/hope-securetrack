"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

const CATEGORIES = [
  "supplier",
  "transport",
  "inventory",
  "production",
  "geopolitical",
  "cyber",
  "climate",
];

export default function ScmRisksPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "supplier",
    risk_level: "medium",
    impact_score: "5",
    mitigation_plan: "",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("supply_chain_risks")
      .select("*, suppliers(name, code)")
      .order("impact_score", { ascending: false });
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
    const code = `RSK-${String(Date.now()).slice(-6)}`;
    const crudRes2 = await crudCreate("supply_chain_risks", {
      company_id: auth.profile.company_id,
      risk_code: code,
      title: form.title,
      category: form.category,
      risk_level: form.risk_level,
      impact_score: Number(form.impact_score),
      mitigation_plan: form.mitigation_plan || null,
      status: "open",
    });
    if (!crudRes2.ok) toast.error(crudRes2.error);
    else {
      toast.success("Risk registered");
      setOpen(false);
      load();
    }
  };

  const setStatus = async (id: string, status: string) => {
    const supabase = createClient();
    const crudRes = await crudUpdate("supply_chain_risks", id, { status });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success(`Marked ${status}`);
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Supply Chain Risk Management"
        description="Supplier · transport · inventory · production · geopolitical · climate · cyber"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/scm">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Log risk
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register risk</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Select
                        value={form.category}
                        onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Level</Label>
                      <Select
                        value={form.risk_level}
                        onValueChange={(v) => setForm((f) => ({ ...f, risk_level: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["low", "medium", "high", "critical"].map((l) => (
                            <SelectItem key={l} value={l}>
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Mitigation plan</Label>
                    <Input
                      value={form.mitigation_plan}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, mitigation_plan: e.target.value }))
                      }
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No risks logged" description="Track resilience threats" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Level</TableHead>
                <TableHead className="text-right">Impact</TableHead>
                <TableHead className="text-right">Prob %</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">
                    {String(r.risk_code)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{String(r.title)}</div>
                    {r.mitigation_plan != null && String(r.mitigation_plan) !== "" && (
                      <div className="text-xs text-muted-foreground max-w-xs truncate">
                        {String(r.mitigation_plan)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">
                    {String(r.category)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={String(r.risk_level)} />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.impact_score))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.probability_pct ?? 0))}%
                  </TableCell>
                  <TableCell className="text-sm">
                    {String(r.owner_name ?? "—")}
                  </TableCell>
                  <TableCell>
                    {r.due_date ? formatDate(String(r.due_date)) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={String(r.status)} />
                  </TableCell>
                  <TableCell>
                    {r.status === "open" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(String(r.id), "mitigating")}
                      >
                        Mitigate
                      </Button>
                    )}
                    {r.status === "mitigating" && (
                      <Button size="sm" onClick={() => setStatus(String(r.id), "closed")}>
                        Close
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
