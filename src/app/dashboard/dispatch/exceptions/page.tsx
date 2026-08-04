"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";
import { createException, EXCEPTION_TYPES } from "@/lib/dispatch";
import { formatDateTime } from "@/lib/utils";

export default function DispatchExceptionsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    exception_type: "delayed",
    title: "",
    detail: "",
    severity: "medium",
  });

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("dsp_exceptions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
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
      await createException({
        company_id: companyId,
        exception_type: form.exception_type,
        title: form.title,
        detail: form.detail,
        severity: form.severity,
        created_by: userId,
      });
      toast.success("Exception opened · Service Desk notified");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const resolve = async (id: string) => {
    const crudRes = await crudUpdate("dsp_exceptions", id, { status: "resolved", resolved_at: new Date().toISOString() });
    toast.success("Resolved");
    await load();
  };

  if (loading) return <LoadingState message="Loading exceptions…" />;

  return (
    <div>
      <PageHeader
        title="Delivery Exceptions"
        description="Partial · refused · damaged · lost · breakdown · auto Service Desk"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Exception</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Log exception</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.exception_type} onValueChange={(v) => setForm((f) => ({ ...f, exception_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXCEPTION_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Detail</Label>
                    <Input value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Severity</Label>
                    <Select value={form.severity} onValueChange={(v) => setForm((f) => ({ ...f, severity: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
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
        <EmptyState title="No exceptions" description="Failed deliveries appear here." icon={AlertTriangle} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.exception_number)}</TableCell>
                  <TableCell className="text-xs capitalize">{String(r.exception_type)}</TableCell>
                  <TableCell className="text-sm font-medium">{String(r.title)}</TableCell>
                  <TableCell>
                    <Badge variant={r.severity === "high" ? "destructive" : "outline"} className="text-[10px] capitalize">
                      {String(r.severity)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{formatDateTime(String(r.created_at))}</TableCell>
                  <TableCell className="text-right">
                    {r.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => resolve(String(r.id))}>Resolve</Button>
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
