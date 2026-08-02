"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Receipt, Plus } from "lucide-react";
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
import { DocumentActions } from "@/components/documents/document-actions";
import { createClient } from "@/lib/supabase/client";
import { crudCreate, crudDelete, crudUpdate } from "@/lib/api/crud-client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import type { BusinessDocument } from "@/lib/documents";
import { toast } from "sonner";

export default function ApPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    supplier_id: "",
    supplier_invoice_ref: "",
    subtotal: "",
    description: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: sup }] = await Promise.all([
      supabase
        .from("ap_invoices")
        .select("*, suppliers(name, code)")
        .is("deleted_at", null)
        .order("invoice_date", { ascending: false })
        .limit(100),
      supabase
        .from("suppliers")
        .select("id,name,code")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name"),
    ]);
    setRows(data ?? []);
    setSuppliers(sup ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_id) return;
    const sub = Number(form.subtotal);
    if (!Number.isFinite(sub) || sub < 0) {
      toast.error("Enter a valid subtotal");
      return;
    }
    const tax = Math.round(sub * 0.18);
    const num = `AP-INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const res = await crudCreate("ap_invoices", {
      invoice_number: num,
      supplier_id: form.supplier_id,
      supplier_invoice_ref: form.supplier_invoice_ref || null,
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      currency: "UGX",
      subtotal: sub,
      tax_amount: tax,
      total_amount: sub + tax,
      amount_paid: 0,
      status: "draft",
      description: form.description || null,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`AP invoice ${num} created`);
      setOpen(false);
      load();
    }
  };

  const setStatus = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "approved" && auth?.profile?.id) {
      patch.approved_by = auth.profile.id;
      patch.approved_at = new Date().toISOString();
    }
    const res = await crudUpdate("ap_invoices", id, patch);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`Status → ${status}`);
      load();
    }
  };

  const softDelete = async (id: string) => {
    if (!confirm("Archive this AP invoice?")) return;
    const res = await crudDelete("ap_invoices", id);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Archived");
      load();
    }
  };

  if (loading) return <LoadingState />;

  const openAp = rows
    .filter((r) => !["paid", "void"].includes(String(r.status)))
    .reduce(
      (s, r) => s + (Number(r.total_amount) - Number(r.amount_paid)),
      0
    );

  return (
    <div>
      <PageHeader
        title="Accounts Payable"
        description="Supplier invoices · 3-way match ready · payments · CRUD · print"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/finance">Hub</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/procurement/suppliers">Suppliers</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  AP invoice
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>Supplier invoice</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-1">
                    <Label>Supplier</Label>
                    <Select
                      value={form.supplier_id}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, supplier_id: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.code} — {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Supplier invoice ref</Label>
                    <Input
                      value={form.supplier_invoice_ref}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          supplier_invoice_ref: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Subtotal (ex VAT)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={form.subtotal}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, subtotal: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Input
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create draft</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Open AP" value={formatNumber(Math.round(openAp))} icon={Receipt} />
        <StatCard title="Invoices" value={formatNumber(rows.length)} />
        <StatCard
          title="Draft"
          value={formatNumber(rows.filter((r) => r.status === "draft").length)}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Receipt} title="No AP invoices" description="Capture supplier bills" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>AP #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const sup = r.suppliers as { name?: string; code?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.invoice_number)}
                    </TableCell>
                    <TableCell>
                      {sup?.code} — {sup?.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {String(r.supplier_invoice_ref ?? "—")}
                    </TableCell>
                    <TableCell>
                      {r.invoice_date
                        ? formatDate(String(r.invoice_date))
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.total_amount))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.amount_paid))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex flex-wrap gap-1 justify-end">
                        <DocumentActions
                          showLabel={false}
                          size="sm"
                          variant="ghost"
                          doc={(): BusinessDocument => ({
                            title: `AP ${r.invoice_number}`,
                            docType: "Supplier Invoice / AP",
                            number: String(r.invoice_number),
                            date: r.invoice_date
                              ? String(r.invoice_date)
                              : undefined,
                            status: String(r.status),
                            currency: String(r.currency || "UGX"),
                            billToLabel: "Supplier",
                            billToName: sup
                              ? `${sup.code} — ${sup.name}`
                              : "Supplier",
                            subtotal: Number(r.subtotal),
                            tax: Number(r.tax_amount),
                            total: Number(r.total_amount),
                            amountPaid: Number(r.amount_paid),
                            balance:
                              Number(r.total_amount) - Number(r.amount_paid),
                            notes: r.description
                              ? String(r.description)
                              : undefined,
                          })}
                        />
                        {r.status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus(String(r.id), "approved")}
                          >
                            Approve
                          </Button>
                        )}
                        {r.status === "approved" && (
                          <Button
                            size="sm"
                            onClick={() => setStatus(String(r.id), "paid")}
                          >
                            Mark paid
                          </Button>
                        )}
                        {["draft", "void"].includes(String(r.status)) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => softDelete(String(r.id))}
                          >
                            Archive
                          </Button>
                        )}
                      </div>
                    </TableCell>
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
