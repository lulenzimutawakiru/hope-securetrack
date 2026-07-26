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
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  city: string | null;
  is_active: boolean;
}

interface SalesOrder {
  id: string;
  order_number: string;
  status: string;
  order_date: string;
  total_amount: number;
  currency: string;
  customers?: { name: string } | null;
}

interface Product {
  id: string;
  name: string;
  product_code: string;
}

export default function SalesPage() {
  const { auth } = useUser();
  const [tab, setTab] = useState<"orders" | "customers">("orders");
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
    notes: "",
  });
  const [customerForm, setCustomerForm] = useState({
    name: "",
    code: "",
    phone: "",
    email: "",
    city: "Nairobi",
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
    if (!auth) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const code =
        customerForm.code ||
        `CUS-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("customers").insert({
        company_id: auth.profile.company_id,
        name: customerForm.name,
        code,
        phone: customerForm.phone || null,
        email: customerForm.email || null,
        city: customerForm.city || null,
        is_active: true,
      });
      if (error) throw error;
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
    if (!auth) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const qty = parseInt(orderForm.quantity, 10);
      const price = parseFloat(orderForm.unit_price);
      const subtotal = qty * price;
      const tax = subtotal * 0.16;
      const total = subtotal + tax;
      const orderNumber = `SO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const product = products.find((p) => p.id === orderForm.product_id);

      const { data: order, error } = await supabase
        .from("sales_orders")
        .insert({
          company_id: auth.profile.company_id,
          order_number: orderNumber,
          customer_id: orderForm.customer_id || null,
          status: "confirmed",
          order_date: new Date().toISOString().slice(0, 10),
          subtotal,
          tax_amount: tax,
          total_amount: total,
          currency: "KES",
          notes: orderForm.notes || null,
          sales_rep_id: auth.profile.id,
          created_by: auth.profile.id,
        })
        .select()
        .single();
      if (error) throw error;

      const { error: lineErr } = await supabase.from("sales_order_lines").insert({
        order_id: order.id,
        product_id: orderForm.product_id || null,
        description: product?.name || "Product",
        quantity: qty,
        unit: orderForm.unit,
        unit_price: price,
        tax_rate: 16,
      });
      if (lineErr) throw lineErr;

      toast.success(`Order ${orderNumber} created`);
      setOrderOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("sales_orders")
      .update({ status })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Status updated");
      load();
    }
  };

  if (loading) return <LoadingState />;

  const confirmed = orders.filter((o) =>
    ["confirmed", "picking", "dispatched"].includes(o.status)
  ).length;

  return (
    <div>
      <PageHeader
        title="Sales"
        description="Customers and sales orders for Hope Design Group"
        actions={
          <div className="flex gap-2">
            <Dialog open={customerOpen} onOpenChange={setCustomerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Customer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createCustomer}>
                  <DialogHeader>
                    <DialogTitle>New customer</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        required
                        value={customerForm.name}
                        onChange={(e) =>
                          setCustomerForm({ ...customerForm, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code</Label>
                      <Input
                        value={customerForm.code}
                        onChange={(e) =>
                          setCustomerForm({ ...customerForm, code: e.target.value })
                        }
                        placeholder="Auto if empty"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={customerForm.phone}
                          onChange={(e) =>
                            setCustomerForm({ ...customerForm, phone: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input
                          value={customerForm.city}
                          onChange={(e) =>
                            setCustomerForm({ ...customerForm, city: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={customerForm.email}
                        onChange={(e) =>
                          setCustomerForm({ ...customerForm, email: e.target.value })
                        }
                      />
                    </div>
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
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          value={orderForm.quantity}
                          onChange={(e) =>
                            setOrderForm({ ...orderForm, quantity: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unit</Label>
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
                      </div>
                      <div className="space-y-2">
                        <Label>Unit price</Label>
                        <Input
                          type="number"
                          value={orderForm.unit_price}
                          onChange={(e) =>
                            setOrderForm({ ...orderForm, unit_price: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={saving || !orderForm.customer_id || !orderForm.product_id}
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
        <StatCard title="Open pipeline" value={formatNumber(confirmed)} />
        <StatCard title="Customers" value={formatNumber(customers.length)} />
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          size="sm"
          variant={tab === "orders" ? "default" : "outline"}
          onClick={() => setTab("orders")}
        >
          Orders
        </Button>
        <Button
          size="sm"
          variant={tab === "customers" ? "default" : "outline"}
          onClick={() => setTab("customers")}
        >
          Customers
        </Button>
      </div>

      {tab === "orders" ? (
        orders.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="No sales orders" />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                    <TableCell>{o.customers?.name ?? "—"}</TableCell>
                    <TableCell>{formatDate(o.order_date)}</TableCell>
                    <TableCell>
                      {o.currency} {formatNumber(Number(o.total_amount))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={o.status}
                        onValueChange={(v) => updateStatus(o.id, v)}
                      >
                        <SelectTrigger className="w-[140px] ml-auto">
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
        )
      ) : customers.length === 0 ? (
        <EmptyState title="No customers" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.code}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{c.city ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
