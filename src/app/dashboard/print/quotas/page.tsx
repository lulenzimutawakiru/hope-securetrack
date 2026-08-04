"use client";

import { useEffect, useState } from "react";
import { Gauge, Plus } from "lucide-react";
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
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

export default function PrintQuotasPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [access, setAccess] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    scope_type: "department",
    scope_key: "",
    max_pages: "500",
    max_labels: "5000",
    period: "monthly",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data }, { data: a }] = await Promise.all([
      sb.from("prt_quotas").select("*").order("scope_type"),
      sb.from("prt_department_access").select("*, printers(name)").limit(50),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setAccess((a as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const crudRes = await crudCreate("prt_quotas", {
        company_id: companyId,
        scope_type: form.scope_type,
        scope_key: form.scope_key,
        period: form.period,
        max_pages: Number(form.max_pages) || 500,
        max_labels: Number(form.max_labels) || 5000,
        used_pages: 0,
        used_labels: 0,
        is_active: true,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Quota created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading quotas…" />;

  return (
    <div>
      <PageHeader
        title="Print Quotas & Access"
        description="User/department limits · RBAC printer permissions · secure print policy"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New quota</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Print quota</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Scope</Label>
                      <Select value={form.scope_type} onValueChange={(v) => setForm((f) => ({ ...f, scope_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="department">Department</SelectItem>
                          <SelectItem value="company">Company</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Period</Label>
                      <Select value={form.period} onValueChange={(v) => setForm((f) => ({ ...f, period: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Scope key (dept/user)</Label>
                    <Input required value={form.scope_key} onChange={(e) => setForm((f) => ({ ...f, scope_key: e.target.value }))} placeholder="Production" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Max pages</Label>
                      <Input type="number" value={form.max_pages} onChange={(e) => setForm((f) => ({ ...f, max_pages: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Max labels</Label>
                      <Input type="number" value={form.max_labels} onChange={(e) => setForm((f) => ({ ...f, max_labels: e.target.value }))} />
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
        <EmptyState icon={Gauge} title="No quotas" description="Set monthly page/label limits by department." />
      ) : (
        <div className="rounded-md border mb-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Pages</TableHead>
                <TableHead className="text-right">Labels</TableHead>
                <TableHead>Usage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const pagePct = Math.round((Number(r.used_pages) / Math.max(1, Number(r.max_pages))) * 100);
                const labelPct = Math.round((Number(r.used_labels) / Math.max(1, Number(r.max_labels))) * 100);
                const high = pagePct >= 85 || labelPct >= 85;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="capitalize text-sm">{String(r.scope_type)}</TableCell>
                    <TableCell className="font-medium text-sm">{String(r.scope_key)}</TableCell>
                    <TableCell className="text-sm">{String(r.period)}</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatNumber(Number(r.used_pages))} / {formatNumber(Number(r.max_pages))}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatNumber(Number(r.used_labels))} / {formatNumber(Number(r.max_labels))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={high ? "destructive" : "outline"} className="text-[10px]">
                        {pagePct}%p · {labelPct}%L
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="text-sm font-medium mb-2">Department printer access</h3>
      {access.length === 0 ? (
        <p className="text-sm text-muted-foreground">No department access rows (seed with migration).</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Printer</TableHead>
                <TableHead>Print</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Secure</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {access.map((a) => {
                const pr = a.printers as { name?: string } | null;
                return (
                  <TableRow key={String(a.id)}>
                    <TableCell className="text-sm">{String(a.department)}</TableCell>
                    <TableCell className="text-sm">{pr?.name || "—"}</TableCell>
                    <TableCell>{a.can_print ? "✓" : "—"}</TableCell>
                    <TableCell>{a.can_color ? "✓" : "—"}</TableCell>
                    <TableCell>{a.can_secure ? "✓" : "—"}</TableCell>
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
