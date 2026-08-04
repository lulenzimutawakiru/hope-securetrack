"use client";

import { useEffect, useState } from "react";
import { FileSignature, Printer } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { recordPod } from "@/lib/dispatch";
import { formatDateTime } from "@/lib/utils";

export default function DispatchPodPage() {
  const { auth } = useUser();
  const [pods, setPods] = useState<Array<Record<string, unknown>>>([]);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    request_id: "",
    receiver_name: "",
    customer_name: "",
    delivered_qty: "1",
    damaged_qty: "0",
    notes: "",
    signature_data: "",
    qr_scanned: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data: p }, { data: r }] = await Promise.all([
      sb.from("dsp_pods").select("*").order("delivered_at", { ascending: false }).limit(100),
      sb.from("dsp_requests").select("id, request_number, customer_name, status").in("status", ["in_transit", "dispatched", "ready", "assigned"]),
    ]);
    setPods((p as Array<Record<string, unknown>>) || []);
    setRequests((r as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !form.receiver_name) return;
    try {
      const req = requests.find((r) => String(r.id) === form.request_id);
      const pod = await recordPod({
        company_id: companyId,
        request_id: form.request_id || null,
        customer_name: form.customer_name || String(req?.customer_name || ""),
        receiver_name: form.receiver_name,
        signature_data: form.signature_data || form.receiver_name,
        delivered_qty: Number(form.delivered_qty) || 0,
        damaged_qty: Number(form.damaged_qty) || 0,
        notes: form.notes,
        qr_scanned: form.qr_scanned,
        lat: 0.3136,
        lng: 32.5811,
      });
      toast.success(`POD ${pod.pod_number} signed`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "POD failed");
    }
  };

  const printPod = (html: string) => {
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  };

  if (loading) return <LoadingState message="Loading POD…" />;

  return (
    <div>
      <PageHeader
        title="Proof of Delivery"
        description="Digital signature · GPS · photos · QR · received quantities · signed document"
      />

      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8 border rounded-lg p-4">
        <div>
          <Label>Request (in transit)</Label>
          <Select value={form.request_id} onValueChange={(v) => setForm((f) => ({ ...f, request_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              {requests.map((r) => (
                <SelectItem key={String(r.id)} value={String(r.id)}>
                  {String(r.request_number)} — {String(r.customer_name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Receiver name</Label>
          <Input required value={form.receiver_name} onChange={(e) => setForm((f) => ({ ...f, receiver_name: e.target.value }))} />
        </div>
        <div>
          <Label>Signature (typed)</Label>
          <Input value={form.signature_data} onChange={(e) => setForm((f) => ({ ...f, signature_data: e.target.value }))} placeholder="Sign name" />
        </div>
        <div>
          <Label>Delivered qty</Label>
          <Input type="number" value={form.delivered_qty} onChange={(e) => setForm((f) => ({ ...f, delivered_qty: e.target.value }))} />
        </div>
        <div>
          <Label>Damaged qty</Label>
          <Input type="number" value={form.damaged_qty} onChange={(e) => setForm((f) => ({ ...f, damaged_qty: e.target.value }))} />
        </div>
        <div>
          <Label>QR scanned</Label>
          <Input value={form.qr_scanned} onChange={(e) => setForm((f) => ({ ...f, qr_scanned: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <Label>Notes</Label>
          <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            <FileSignature className="h-4 w-4 mr-1" /> Capture POD
          </Button>
        </div>
      </form>

      {pods.length === 0 ? (
        <EmptyState title="No POD records" description="Capture delivery confirmation from mobile or here." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Receiver</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>When</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pods.map((p) => (
                <TableRow key={String(p.id)}>
                  <TableCell className="font-mono text-xs">{String(p.pod_number)}</TableCell>
                  <TableCell className="text-sm">{String(p.customer_name || "—")}</TableCell>
                  <TableCell className="text-sm font-medium">{String(p.receiver_name)}</TableCell>
                  <TableCell className="text-xs">
                    {String(p.delivered_qty)} · dmg {String(p.damaged_qty)}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(String(p.delivered_at))}</TableCell>
                  <TableCell className="text-right">
                    {p.document_html ? (
                      <Button size="sm" variant="ghost" onClick={() => printPod(String(p.document_html))}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    ) : null}
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
