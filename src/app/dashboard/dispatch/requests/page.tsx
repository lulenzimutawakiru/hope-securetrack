"use client";

import { useEffect, useState } from "react";
import { Plus, Truck } from "lucide-react";
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
import {
  createDispatchRequest,
  dispatchShipment,
  SOURCE_TYPES,
  DELIVERY_TYPES,
} from "@/lib/dispatch";

export default function DispatchRequestsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    customer_name: "",
    source_type: "sales_order",
    source_ref: "",
    delivery_address: "",
    priority: "normal",
    delivery_type: "scheduled",
    delivery_date: "",
    weight_kg: "0",
    volume_m3: "0",
    product_name: "SecureTrack A4 Reams",
    quantity: "1",
  });

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("dsp_requests")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);
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
      await createDispatchRequest({
        company_id: companyId,
        customer_name: form.customer_name,
        source_type: form.source_type,
        source_ref: form.source_ref,
        delivery_address: form.delivery_address,
        priority: form.priority,
        delivery_type: form.delivery_type,
        delivery_date: form.delivery_date || undefined,
        weight_kg: Number(form.weight_kg) || 0,
        volume_m3: Number(form.volume_m3) || 0,
        created_by: userId,
        lines: [
          {
            product_name: form.product_name,
            quantity: Number(form.quantity) || 1,
            weight_kg: Number(form.weight_kg) || 0,
          },
        ],
      });
      toast.success("Dispatch request created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const doDispatch = async (id: string) => {
    if (!companyId) return;
    try {
      const d = await dispatchShipment({
        company_id: companyId,
        request_id: id,
        actor_id: userId,
      });
      toast.success(`Dispatched ${d.dispatch_number}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dispatch failed");
    }
  };

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      String(r.request_number).toLowerCase().includes(s) ||
      String(r.customer_name || "").toLowerCase().includes(s) ||
      String(r.source_ref || "").toLowerCase().includes(s)
    );
  });

  if (loading) return <LoadingState message="Loading dispatch requests…" />;

  return (
    <div>
      <PageHeader
        title="Dispatch Requests"
        description="From sales · production · transfers · returns · service · inter-branch"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Request</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>New dispatch request</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Customer / destination</Label>
                    <Input required value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Source</Label>
                      <Select value={form.source_type} onValueChange={(v) => setForm((f) => ({ ...f, source_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SOURCE_TYPES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Source ref</Label>
                      <Input value={form.source_ref} onChange={(e) => setForm((f) => ({ ...f, source_ref: e.target.value }))} placeholder="SO-…" />
                    </div>
                  </div>
                  <div>
                    <Label>Delivery address</Label>
                    <Input value={form.delivery_address} onChange={(e) => setForm((f) => ({ ...f, delivery_address: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Priority</Label>
                      <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="express">Express</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select value={form.delivery_type} onValueChange={(v) => setForm((f) => ({ ...f, delivery_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DELIVERY_TYPES.map((d) => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Date</Label>
                      <Input type="date" value={form.delivery_date} onChange={(e) => setForm((f) => ({ ...f, delivery_date: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Weight kg</Label>
                      <Input type="number" value={form.weight_kg} onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Volume m³</Label>
                      <Input type="number" value={form.volume_m3} onChange={(e) => setForm((f) => ({ ...f, volume_m3: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Product line</Label>
                      <Input value={form.product_name} onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Qty</Label>
                      <Input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Input className="max-w-sm mb-4" placeholder="Search request, customer, ref…" value={q} onChange={(e) => setQ(e.target.value)} />

      {filtered.length === 0 ? (
        <EmptyState title="No requests" description="Create a request or apply migration 00041." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.request_number)}</TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{String(r.customer_name)}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">{String(r.delivery_address || "")}</p>
                  </TableCell>
                  <TableCell className="text-xs">
                    {String(r.source_type)} · {String(r.source_ref || "—")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.priority === "high" || r.priority === "express" ? "default" : "outline"} className="text-[10px] capitalize">
                      {String(r.priority)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{String(r.weight_kg)} kg</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {["pending", "planned", "assigned", "ready"].includes(String(r.status)) && (
                      <Button size="sm" variant="outline" onClick={() => doDispatch(String(r.id))}>
                        <Truck className="h-3 w-3 mr-1" /> Dispatch
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
