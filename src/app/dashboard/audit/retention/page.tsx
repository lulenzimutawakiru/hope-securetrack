"use client";

import { useEffect, useState } from "react";
import { Clock, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { RETENTION_PRESETS } from "@/lib/audit";

export default function AuditRetentionPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    module_scope: "*",
    retention_days: "365",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("eal_retention_policies")
      .select("*")
      .order("name");
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const { error } = await createClient().from("eal_retention_policies").insert({
        company_id: companyId,
        name: form.name,
        module_scope: form.module_scope,
        retention_days: Number(form.retention_days),
        is_active: true,
      });
      if (error) throw error;
      toast.success("Retention policy created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const labelDays = (d: number) => {
    if (d < 0) return "Permanent";
    const p = RETENTION_PRESETS.find((x) => x.days === d);
    return p ? p.label : `${d} days`;
  };

  if (loading) return <LoadingState message="Loading retention policies…" />;

  return (
    <div>
      <PageHeader
        title="Retention Policies"
        description="30d · 90d · 1y · 3y · 5y · 7y · permanent · legal hold"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add policy</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Retention policy</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Module scope</Label>
                    <Input value={form.module_scope} onChange={(e) => setForm((f) => ({ ...f, module_scope: e.target.value }))} placeholder="* or finance" />
                  </div>
                  <div>
                    <Label>Retention</Label>
                    <Select value={form.retention_days} onValueChange={(v) => setForm((f) => ({ ...f, retention_days: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RETENTION_PRESETS.map((p) => (
                          <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No policies" description="Seed policies ship with migration 00039." icon={Clock} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Retention</TableHead>
                <TableHead>Archive after</TableHead>
                <TableHead>Legal hold</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-medium text-sm">{String(r.name)}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.module_scope)}</TableCell>
                  <TableCell>{labelDays(Number(r.retention_days))}</TableCell>
                  <TableCell className="text-xs">
                    {r.archive_after_days != null ? `${r.archive_after_days}d` : "—"}
                  </TableCell>
                  <TableCell>
                    {r.legal_hold ? <Badge variant="destructive" className="text-[10px]">Hold</Badge> : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.is_active ? "default" : "outline"} className="text-[10px]">
                      {r.is_active ? "Yes" : "No"}
                    </Badge>
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
