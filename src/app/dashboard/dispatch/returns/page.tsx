"use client";

import { useEffect, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
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
import { createReturn } from "@/lib/dispatch";
import { formatDateTime } from "@/lib/utils";

export default function DispatchReturnsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    return_type: "customer",
    reason: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("dsp_returns")
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
      const r = await createReturn({
        company_id: companyId,
        customer_name: form.customer_name,
        return_type: form.return_type,
        reason: form.reason,
        created_by: userId,
      });
      toast.success(`RMA ${r.return_number}`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const advance = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "credited") patch.credit_note_ref = `CN-${Date.now().toString(36).toUpperCase()}`;
    await createClient().from("dsp_returns").update(patch).eq("id", id);
    toast.success(`Status → ${status}`);
    await load();
  };

  if (loading) return <LoadingState message="Loading returns…" />;

  return (
    <div>
      <PageHeader
        title="Returns Management"
        description="Customer · rejected · damaged · warranty · recall · credit notes"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> RMA</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Return authorization</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Customer</Label>
                    <Input required value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.return_type} onValueChange={(v) => setForm((f) => ({ ...f, return_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer return</SelectItem>
                        <SelectItem value="rejected">Rejected delivery</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                        <SelectItem value="warranty">Warranty</SelectItem>
                        <SelectItem value="recall">Recall</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Reason</Label>
                    <Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Authorize</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No returns" description="Authorize RMAs for rejected or damaged goods." icon={RotateCcw} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>When</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.return_number)}</TableCell>
                  <TableCell className="text-sm">{String(r.customer_name)}</TableCell>
                  <TableCell className="text-xs capitalize">{String(r.return_type)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{String(r.credit_note_ref || "—")}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(String(r.created_at))}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status === "authorized" && (
                      <Button size="sm" variant="outline" onClick={() => advance(String(r.id), "collected")}>Collect</Button>
                    )}
                    {r.status === "collected" && (
                      <Button size="sm" variant="outline" onClick={() => advance(String(r.id), "restocked")}>Restock</Button>
                    )}
                    {["restocked", "inspecting"].includes(String(r.status)) && (
                      <Button size="sm" onClick={() => advance(String(r.id), "credited")}>Credit</Button>
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
