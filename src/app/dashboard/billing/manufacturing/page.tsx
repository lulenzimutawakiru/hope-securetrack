"use client";

import { useEffect, useState } from "react";
import { Factory, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { createInvoice } from "@/lib/billing";
import { formatDate, formatNumber } from "@/lib/utils";

/**
 * Manufacturing / dispatch billing — invoice from delivery notes & production.
 */
export default function ManufacturingBillingPage() {
  const { auth } = useUser();
  const [dispatches, setDispatches] = useState<Array<Record<string, unknown>>>([]);
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [warranty, setWarranty] = useState("12 months manufacturer warranty");
  const [batch, setBatch] = useState("");

  const load = async () => {
    const supabase = createClient();
    const [{ data: d }, { data: l }] = await Promise.all([
      supabase
        .from("dispatches")
        .select("*, customers(name), sales_orders(order_number), invoices(invoice_number)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("bill_delivery_links")
        .select("*, invoices(invoice_number)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setDispatches(d ?? []);
    setLinks(l ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const invoiceDispatch = async (d: Record<string, unknown>) => {
    if (!auth?.profile?.company_id) return;
    if (d.invoice_id) {
      toast.message("Already linked to an invoice");
      return;
    }
    try {
      const supabase = createClient();
      // load dispatch items if any
      const { data: lines } = await supabase
        .from("dispatch_items")
        .select("*")
        .eq("dispatch_id", d.id);

      const invLines =
        lines && lines.length
          ? lines.map((l: Record<string, unknown>) => ({
              description: String(
                l.notes ||
                  l.serial_number ||
                  l.item_type ||
                  "Dispatched goods"
              ),
              quantity: Number(l.quantity || 1),
              unit: String(l.item_type || "ea"),
              unit_price: Number(l.unit_price || 0) || 0,
              tax_code: "VAT18",
              tax_rate: 18,
            }))
          : [
              {
                description: `Delivery ${d.dispatch_number} — finished goods`,
                quantity: 1,
                unit: "lot",
                unit_price: Number(d.total_amount || 0) || 500000,
                tax_code: "VAT18",
                tax_rate: 18,
              },
            ];

      const deliveredQty = invLines.reduce((s, l) => s + l.quantity, 0);

      const inv = await createInvoice(supabase, {
        company_id: auth.profile.company_id,
        customer_id: (d.customer_id as string) || null,
        sales_order_id: (d.sales_order_id as string) || null,
        invoice_type: "tax",
        source_type: "delivery",
        source_ref: String(d.dispatch_number),
        notes: `From delivery note ${d.dispatch_number}`,
        lines: invLines,
        created_by: auth.profile.id,
      });

      await crudUpdate("invoices", inv.id, {
          dispatch_id: d.id,
          batch_numbers: batch || null,
          warranty_note: warranty || null,
          production_order_ref: String(d.production_order_ref || d.dispatch_number),
        });

      await crudCreate("bill_delivery_links", {
        company_id: auth.profile.company_id,
        dispatch_id: d.id,
        sales_order_id: d.sales_order_id || null,
        invoice_id: inv.id,
        customer_id: d.customer_id || null,
        delivered_qty: deliveredQty,
        invoiced_qty: deliveredQty,
        remaining_qty: 0,
        status: "fully_invoiced",
      });

      // link reverse on dispatch if column allows
      try {
        await crudUpdate("dispatches", String(d.id), { invoice_id: inv.id });
      } catch {
        /* optional */
      }

      toast.success(`Invoice ${inv.invoice_number} from dispatch`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to invoice dispatch");
    }
  };

  if (loading) return <LoadingState message="Loading manufacturing billing…" />;

  return (
    <div>
      <PageHeader
        title="Manufacturing & Delivery Billing"
        description="Invoice from production · finished goods · delivery notes · batch / QR / warranty"
      />

      <div className="grid gap-3 sm:grid-cols-2 mb-6 max-w-2xl">
        <div>
          <Label>Default warranty note</Label>
          <Input value={warranty} onChange={(e) => setWarranty(e.target.value)} />
        </div>
        <div>
          <Label>Batch numbers (optional)</Label>
          <Input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="BATCH-2026-001" />
        </div>
      </div>

      {dispatches.length === 0 ? (
        <EmptyState
          title="No dispatches"
          description="Create warehouse dispatches first, then invoice delivered quantities."
          icon={Factory}
        />
      ) : (
        <div className="rounded-md border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dispatch</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dispatches.map((d) => (
                <TableRow key={String(d.id)}>
                  <TableCell className="font-mono text-xs">{String(d.dispatch_number)}</TableCell>
                  <TableCell>{(d.customers as { name?: string } | null)?.name || "—"}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {(d.sales_orders as { order_number?: string } | null)?.order_number || "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {d.dispatch_date ? formatDate(String(d.dispatch_date)) : "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={String(d.status)} /></TableCell>
                  <TableCell className="text-xs font-mono">
                    {(d.invoices as { invoice_number?: string } | null)?.invoice_number ||
                      (d.invoice_id ? "Linked" : "—")}
                  </TableCell>
                  <TableCell>
                    {!d.invoice_id && !(d.invoices as { invoice_number?: string } | null)?.invoice_number && (
                      <Button size="sm" onClick={() => invoiceDispatch(d)}>
                        <FileText className="h-3.5 w-3.5 mr-1" /> Invoice
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {links.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mb-2">Delivery → invoice tracking</h3>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Delivered qty</TableHead>
                  <TableHead>Invoiced qty</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((l) => (
                  <TableRow key={String(l.id)}>
                    <TableCell>{formatNumber(Number(l.delivered_qty))}</TableCell>
                    <TableCell>{formatNumber(Number(l.invoiced_qty))}</TableCell>
                    <TableCell>{formatNumber(Number(l.remaining_qty))}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {(l.invoices as { invoice_number?: string } | null)?.invoice_number || "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={String(l.status)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
