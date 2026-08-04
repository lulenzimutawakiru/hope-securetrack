"use client";

import { useEffect, useState } from "react";
import { Package, Plus } from "lucide-react";
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
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { createAuditPackage, COMPLIANCE_FRAMEWORKS } from "@/lib/audit";

export default function AuditPackagesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "Q1 Security Audit Package",
    framework_code: "ISO27001",
    period_start: "",
    period_end: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("eal_audit_packages")
      .select("*")
      .order("created_at", { ascending: false });
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
      const pkg = await createAuditPackage({
        company_id: companyId,
        name: form.name,
        framework_code: form.framework_code,
        period_start: form.period_start || undefined,
        period_end: form.period_end || undefined,
        created_by: userId,
      });
      toast.success(`Package ${pkg.package_number} ready`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const exportJson = (pkg: Record<string, unknown>) => {
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${pkg.package_number}-audit-package.json`;
    a.click();
    toast.success("Package metadata exported");
  };

  if (loading) return <LoadingState message="Loading audit packages…" />;

  return (
    <div>
      <PageHeader
        title="Audit Packages"
        description="Regulatory exports · control evidence · period-scoped event bundles"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Build package</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Audit package</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Framework</Label>
                    <Select value={form.framework_code} onValueChange={(v) => setForm((f) => ({ ...f, framework_code: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COMPLIANCE_FRAMEWORKS.map((f) => (
                          <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Period start</Label>
                      <Input type="date" value={form.period_start} onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Period end</Label>
                      <Input type="date" value={form.period_end} onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Generate</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No packages" description="Build a package for external auditors." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Framework</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Controls</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.package_number)}</TableCell>
                  <TableCell className="font-medium text-sm flex items-center gap-1">
                    <Package className="h-3 w-3" /> {String(r.name)}
                  </TableCell>
                  <TableCell className="text-xs">{String(r.framework_code || "—")}</TableCell>
                  <TableCell>{String(r.event_count ?? 0)}</TableCell>
                  <TableCell>{String(r.control_count ?? 0)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{formatDateTime(String(r.created_at))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => exportJson(r)}>Export</Button>
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
