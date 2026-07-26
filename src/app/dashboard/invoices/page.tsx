"use client";

import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
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
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
  currency: string;
  customers?: { name: string } | null;
  sales_orders?: { order_number: string } | null;
}

interface SalesOrder {
  id: string;
  order_number: string;
  customer_id: string | null;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  status: string;
}

export default function InvoicesPage() {
  const { auth } = useUser();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [orderId, setOrderId] = useState("");

  const load = async () => {
    const supabase = createClient();
    const [{ data: inv }, { data: so }] = await Promise.all([
      supabase
        .from("invoices")
        .select("*, customers(name), sales_orders(order_number)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("sales_orders")
        .select("id,order_number,customer_id,total_amount,subtotal,tax_amount,status")
        .in("status", ["confirmed", "picking", "dispatched", "completed"])
        .order("created_at", { ascending: false }),
    ]);
    setInvoices((inv as Invoice[]) ?? []);
    setOrders((so as SalesOrder[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createFromOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !orderId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const order = orders.find((o) => o.id === orderId);
      if (!order) throw new Error("Order not found");

      const invNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const due = new Date();
      due.setDate(due.getDate() + 30);

      const { data: inv, error } = await supabase
        .from("invoices")
        .insert({
          company_id: auth.profile.company_id,
          invoice_number: invNumber,
          sales_order_id: order.id,
          customer_id: order.customer_id,
          status: "issued",
          invoice_date: new Date().toISOString().slice(0, 10),
          due_date: due.toISOString().slice(0, 10),
          subtotal: order.subtotal,
          tax_amount: order.tax_amount,
          total_amount: order.total_amount,
          amount_paid: 0,
          currency: "KES",
          issued_by: auth.profile.id,
        })
        .select()
        .single();
      if (error) throw error;

      const { data: lines } = await supabase
        .from("sales_order_lines")
        .select("*")
        .eq("order_id", order.id);

      if (lines?.length) {
        await supabase.from("invoice_lines").insert(
          lines.map((l) => ({
            invoice_id: inv.id,
            product_id: l.product_id,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unit_price: l.unit_price,
            tax_rate: l.tax_rate,
          }))
        );
      }

      await supabase
        .from("sales_orders")
        .update({ status: "invoiced" })
        .eq("id", order.id);

      toast.success(`Invoice ${invNumber} issued`);
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !payInvoiceId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const inv = invoices.find((i) => i.id === payInvoiceId);
      if (!inv) throw new Error("Invoice not found");
      const amount = parseFloat(payAmount);
      if (!amount || amount <= 0) throw new Error("Invalid amount");

      const { error } = await supabase.from("invoice_payments").insert({
        invoice_id: inv.id,
        company_id: auth.profile.company_id,
        amount,
        payment_date: new Date().toISOString().slice(0, 10),
        method: "mpesa",
        recorded_by: auth.profile.id,
      });
      if (error) throw error;

      const paid = Number(inv.amount_paid) + amount;
      const status =
        paid >= Number(inv.total_amount)
          ? "paid"
          : paid > 0
            ? "partially_paid"
            : inv.status;

      await supabase
        .from("invoices")
        .update({ amount_paid: paid, status })
        .eq("id", inv.id);

      toast.success("Payment recorded");
      setPayOpen(false);
      setPayAmount("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  const outstanding = invoices
    .filter((i) => !["paid", "void", "cancelled"].includes(i.status))
    .reduce((s, i) => s + (Number(i.total_amount) - Number(i.amount_paid)), 0);

  return (
    <div>
      <PageHeader
        title="Invoicing"
        description="Issue invoices from sales orders and record payments"
        actions={
          <div className="flex gap-2">
            <Dialog open={payOpen} onOpenChange={setPayOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Record payment</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={recordPayment}>
                  <DialogHeader>
                    <DialogTitle>Record payment</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-4">
                    <div className="space-y-2">
                      <Label>Invoice</Label>
                      <Select value={payInvoiceId} onValueChange={setPayInvoiceId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select invoice" />
                        </SelectTrigger>
                        <SelectContent>
                          {invoices
                            .filter((i) => i.status !== "paid")
                            .map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.invoice_number} — balance{" "}
                                {formatNumber(
                                  Number(i.total_amount) - Number(i.amount_paid)
                                )}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (KES)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving || !payInvoiceId}>
                      Save payment
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Invoice from order
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createFromOrder}>
                  <DialogHeader>
                    <DialogTitle>Create invoice</DialogTitle>
                  </DialogHeader>
                  <div className="py-4 space-y-2">
                    <Label>Sales order</Label>
                    <Select value={orderId} onValueChange={setOrderId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select order" />
                      </SelectTrigger>
                      <SelectContent>
                        {orders.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.order_number} — KES{" "}
                            {formatNumber(Number(o.total_amount))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving || !orderId}>
                      Issue invoice
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Invoices" value={formatNumber(invoices.length)} icon={FileText} />
        <StatCard
          title="Outstanding"
          value={`KES ${formatNumber(Math.round(outstanding))}`}
        />
        <StatCard
          title="Paid"
          value={formatNumber(
            invoices.filter((i) => i.status === "paid").length
          )}
        />
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices yet" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-sm">
                    {i.invoice_number}
                  </TableCell>
                  <TableCell>{i.customers?.name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {i.sales_orders?.order_number ?? "—"}
                  </TableCell>
                  <TableCell>{formatDate(i.invoice_date)}</TableCell>
                  <TableCell>
                    {i.currency} {formatNumber(Number(i.total_amount))}
                  </TableCell>
                  <TableCell>
                    {formatNumber(Number(i.amount_paid))}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={i.status} />
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
