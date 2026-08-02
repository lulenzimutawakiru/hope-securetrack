"use client";

import { useEffect, useState } from "react";
import { Plus, ShoppingCart } from "lucide-react";
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
import { apiPost } from "@/lib/api-client";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
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
  customers?: { name: string } | null;
}

interface Product {
  id: string;
  name: string;
  product_code: string;
}

const ORDER_TYPES = [
  "standard",
  "blanket",
  "contract",
  "repeat",
  "rush",
  "government",
  "export",
];

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
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

  const load = async () => {
    const supabase = createClient();
    const [{ data: o }, { data: c }, { data: p }] = await Promise.all([
      supabase
        .from("sales_orders")
        .select("*, customers(name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("customers").select("*").order("name"),
      supabase.from("products").select("id,name,product_code").eq("is_active", true),
    ]);
    setOrders((o as SalesOrder[]) ?? []);
    setCustomers((c as Customer[]) ?? []);
    setProducts((p as Product[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const code =
        customerForm.code || `CUS-${Date.now().toString(36).toUpperCase()}`;
      const res = await crudCreate("customers", {
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
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Customer created");
      setCustomerOpen(false);
      load();
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
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const data = res.data as { order_number?: string; credit_approved?: boolean };
      if (data.credit_approved === false) {
        toast.message(`Order ${data.order_number ?? ""} on credit hold`);
      } else {
        toast.success(`Order ${data.order_number ?? ""} confirmed`);
      }
      setOrderOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const res = await crudUpdate("sales_orders", id, { status });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Status updated");
      load();
    }
  };

  if (loading) return <LoadingState />;

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
                    <Select
                      value={orderForm.customer_id}
                      onValueChange={(v) =>
                        setOrderForm({ ...orderForm, customer_id: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={orderForm.order_type}
                      onValueChange={(v) =>
                        setOrderForm({ ...orderForm, order_type: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={orderForm.product_id}
                      onValueChange={(v) =>
                        setOrderForm({ ...orderForm, product_id: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={orderForm.quantity}
                        onChange={(e) =>
                          setOrderForm({ ...orderForm, quantity: e.target.value })
                        }
                      />
                      <Select
                        value={orderForm.unit}
                        onValueChange={(v) =>
                          setOrderForm({ ...orderForm, unit: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="carton">Carton</SelectItem>
                          <SelectItem value="ream">Ream</SelectItem>
                        </SelectContent>
                      </Select>
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

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Orders" value={formatNumber(orders.length)} icon={ShoppingCart} />
        <StatCard
          title="Customers"
          value={formatNumber(customers.length)}
        />
        <StatCard
          title="Credit holds"
          value={formatNumber(orders.filter((o) => !o.credit_approved && o.status === "draft").length)}
        />
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No sales orders" />
      ) : (
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
                <TableHead className="text-right">Update</TableHead>
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
                    <Select
                      value={o.status}
                      onValueChange={(v) => updateStatus(o.id, v)}
                    >
                      <SelectTrigger className="w-[130px] ml-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "draft",
                          "confirmed",
                          "picking",
                          "dispatched",
                          "invoiced",
                          "completed",
                          "cancelled",
                        ].map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
