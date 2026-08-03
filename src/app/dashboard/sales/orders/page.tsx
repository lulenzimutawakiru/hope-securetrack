"use client";

import { useEffect, useState } from "react";
import { Plus, Search, ShoppingCart } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { useEntityList, useCrudMutation } from "@/hooks/use-entity-query";
import { entityKeys } from "@/lib/api/query-keys";
import { apiGet, apiPost } from "@/lib/api-client";
import { DocumentActions } from "@/components/documents/document-actions";
import type { BusinessDocument } from "@/lib/documents";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

interface Customer {
  id: string;
  code: string;
  name: string;
  credit_limit?: number;
  credit_status?: string;
}

interface SalesOrder {
  id: string;
  order_number: string;
  status: string;
  order_date: string;
  order_type?: string;
  total_amount: number;
  currency?: string;
  credit_approved?: boolean;
  requires_production?: boolean;
  customers?: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  } | null;
}

interface Product {
  id: string;
  name: string;
  product_code: string;
}

const ORDER_STATUSES = [
  "draft",
  "confirmed",
  "picking",
  "dispatched",
  "invoiced",
  "completed",
  "cancelled",
];

const PAGE_SIZE = 100;

export default function SalesOrdersPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [orderOpen, setOrderOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderForm, setOrderForm] = useState({
    customer_id: "",
    product_id: "",
    quantity: "10",
    unit_price: "2500",
    unit: "carton",
    order_type: "standard",
    requires_production: "false",
  });
  const [customerForm, setCustomerForm] = useState({
    name: "",
    code: "",
    phone: "",
    email: "",
    city: "Kampala",
    customer_type: "wholesale",
    credit_limit: "5000000",
  });

  const queryClient = useQueryClient();

  // Reads flow through the hardened CRUD API: tenant/company derived
  // server-side, rows permission-checked, paginated server-side.
  const ordersQuery = useEntityList<SalesOrder>("sales_orders", {
    page,
    pageSize: PAGE_SIZE,
    sort: "created_at",
    order: "desc",
    select: "*, customers(name, email, phone, address)",
    search: search.trim() || undefined,
  });
  const customersQuery = useEntityList<Customer>("customers", {
    pageSize: PAGE_SIZE,
    sort: "name",
  });
  const productsQuery = useEntityList<Product>("products", {
    pageSize: PAGE_SIZE,
    sort: "name",
    filters: { is_active: true },
  });

  const customerCrud = useCrudMutation<Customer>("customers");
  const orderCrud = useCrudMutation<SalesOrder>("sales_orders");

  const orders = ordersQuery.data?.data ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const customers = customersQuery.data?.data ?? [];
  const products = productsQuery.data?.data ?? [];
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildOrderDoc = async (o: SalesOrder): Promise<BusinessDocument> => {
    const linesRes = await apiGet<{ data: Array<Record<string, unknown>> }>(
      `/api/v2/crud/sales_order_lines?filters=${encodeURIComponent(
        JSON.stringify({ order_id: o.id })
      )}`
    );
    const lines = (linesRes.ok ? linesRes.data.data : []).map((l) => ({
      description: String(l.description || ""),
      quantity: Number(l.quantity || 0),
      unit: l.unit ? String(l.unit) : undefined,
      unit_price: Number(l.unit_price || 0),
      amount: Number(
        l.line_total ?? Number(l.quantity || 0) * Number(l.unit_price || 0)
      ),
    }));
    return {
      title: `Sales Order ${o.order_number}`,
      docType: "Sales Order",
      number: o.order_number,
      date: formatDate(o.order_date),
      status: o.status,
      currency: o.currency || "UGX",
      billToLabel: "Order to",
      billToName: o.customers?.name || "Customer",
      billToMeta: [
        o.customers?.address,
        o.customers?.email,
        o.customers?.phone,
      ].filter((v): v is string => Boolean(v)),
      meta: [
        { label: "Type", value: o.order_type || "standard" },
        { label: "Credit", value: o.credit_approved ? "Approved" : "On hold" },
      ],
      lines,
      total: Number(o.total_amount || 0),
      footerNote: "Thank you for your order",
    };
  };

  // Debounce the search box before it reaches the server-side query.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const createCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const code = customerForm.code || `CUS-${Date.now().toString(36).toUpperCase()}`;
      const res = await customerCrud.create({
        name: customerForm.name,
        code,
        phone: customerForm.phone || null,
        email: customerForm.email || null,
        city: customerForm.city || null,
        customer_type: customerForm.customer_type,
        credit_limit: parseFloat(customerForm.credit_limit) || 0,
        currency: "UGX",
        payment_terms_days: 30,
        credit_status: "ok",
        is_active: true,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Customer created");
      setCustomerOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiPost("/api/sales/orders", {
        customer_id: orderForm.customer_id,
        product_id: orderForm.product_id,
        quantity: parseInt(orderForm.quantity, 10),
        unit_price: parseFloat(orderForm.unit_price),
        unit: orderForm.unit,
        order_type: orderForm.order_type,
        requires_production: orderForm.requires_production === "true",
      });
      if (!res.ok) throw new Error(res.error);
      const data = res.data as { order_number?: string; credit_approved?: boolean };
      if (data.credit_approved === false) {
        toast.message(`Order ${data.order_number ?? ""} on credit hold`);
      } else {
        toast.success(`Order ${data.order_number ?? ""} confirmed`);
      }
      setOrderOpen(false);
      queryClient.invalidateQueries({
        queryKey: entityKeys.entity("sales_orders"),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const res = await orderCrud.update(id, { status });
    if (!res.ok) toast.error(res.error);
    else toast.success("Status updated");
  };

  if (ordersQuery.isPending) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        description="Standard, rush, government, export · credit check · production flag · commission accrual"
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/sales">
              <Button variant="ghost" size="sm">
                Command center
              </Button>
            </Link>
            <Dialog open={customerOpen} onOpenChange={setCustomerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Customer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createCustomer}>
                  <DialogHeader>
                    <DialogTitle>Customer account</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-4">
                    <Input
                      required
                      placeholder="Company name"
                      value={customerForm.name}
                      onChange={(e) =>
                        setCustomerForm({ ...customerForm, name: e.target.value })
                      }
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="Code"
                        value={customerForm.code}
                        onChange={(e) =>
                          setCustomerForm({ ...customerForm, code: e.target.value })
                        }
                      />
                      <Select
                        value={customerForm.customer_type}
                        onValueChange={(v) =>
                          setCustomerForm({ ...customerForm, customer_type: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "wholesale",
                            "retail",
                            "dealer",
                            "distributor",
                            "government",
                            "export",
                          ].map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      placeholder="Credit limit (UGX)"
                      type="number"
                      value={customerForm.credit_limit}
                      onChange={(e) =>
                        setCustomerForm({
                          ...customerForm,
                          credit_limit: e.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder="Phone"
                      value={customerForm.phone}
                      onChange={(e) =>
                        setCustomerForm({ ...customerForm, phone: e.target.value })
                      }
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>
                      Save
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> New order
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createOrder}>
                  <DialogHeader>
                    <DialogTitle>Sales order</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-4">
                    <div className="space-y-2">
                      <Label>Customer</Label>
                      <Select
                        value={orderForm.customer_id}
                        onValueChange={(v) =>
                          setOrderForm({ ...orderForm, customer_id: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Product</Label>
                      <Select
                        value={orderForm.product_id}
                        onValueChange={(v) =>
                          setOrderForm({ ...orderForm, product_id: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({p.product_code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          value={orderForm.quantity}
                          onChange={(e) =>
                            setOrderForm({ ...orderForm, quantity: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unit price</Label>
                        <Input
                          type="number"
                          value={orderForm.unit_price}
                          onChange={(e) =>
                            setOrderForm({
                              ...orderForm,
                              unit_price: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <Select
                      value={orderForm.requires_production}
                      onValueChange={(v) =>
                        setOrderForm({ ...orderForm, requires_production: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Production needed?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Stock available</SelectItem>
                        <SelectItem value="true">Trigger production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={
                        saving || !orderForm.customer_id || !orderForm.product_id
                      }
                    >
                      Create order
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search order number…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Orders" value={formatNumber(total)} icon={ShoppingCart} />
        <StatCard title="Customers" value={formatNumber(customers.length)} />
        <StatCard
          title="Credit holds"
          value={formatNumber(
            orders.filter((o) => !o.credit_approved && o.status === "draft").length
          )}
        />
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No sales orders" />
      ) : (
        <div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                    <TableCell className="capitalize text-xs">
                      {o.order_type || "standard"}
                      {o.requires_production ? " · MTO" : ""}
                    </TableCell>
                    <TableCell>{o.customers?.name ?? "—"}</TableCell>
                    <TableCell>{formatDate(o.order_date)}</TableCell>
                    <TableCell>
                      {o.currency || "UGX"} {formatNumber(Number(o.total_amount))}
                    </TableCell>
                    <TableCell>
                      {o.credit_approved ? (
                        <StatusBadge status="approved" />
                      ) : (
                        <StatusBadge status="on_hold" />
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <DocumentActions doc={() => buildOrderDoc(o)} />
                        <Select
                          value={o.status}
                          onValueChange={(v) => updateStatus(o.id, v)}
                        >
                        <SelectTrigger className="w-[130px] ml-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
