"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { crudCreate } from "@/lib/api/crud-client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function Customer360Page() {
  const { id } = useParams<{ id: string }>();
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Record<string, unknown> | null>(null);
  const [contacts, setContacts] = useState<Array<Record<string, unknown>>>([]);
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [invoices, setInvoices] = useState<Array<Record<string, unknown>>>([]);
  const [tickets, setTickets] = useState<Array<Record<string, unknown>>>([]);
  const [activities, setActivities] = useState<Array<Record<string, unknown>>>([]);
  const [notes, setNotes] = useState<Array<Record<string, unknown>>>([]);
  const [noteBody, setNoteBody] = useState("");
  const [contactForm, setContactForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    title: "",
  });

  const load = async () => {
    if (!id) return;
    const supabase = createClient();
    const [
      { data: c },
      { data: ct },
      { data: o },
      { data: inv },
      { data: tk },
      { data: act },
      { data: n },
    ] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase.from("crm_contacts").select("*").eq("customer_id", id).order("is_primary", { ascending: false }),
      supabase.from("sales_orders").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(20),
      supabase.from("invoices").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(20),
      supabase.from("support_tickets").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(20),
      supabase.from("crm_activities").select("*").eq("customer_id", id).order("scheduled_at", { ascending: false }).limit(20),
      supabase.from("crm_notes").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(30),
    ]);
    setCustomer(c);
    setContacts(ct ?? []);
    setOrders(o ?? []);
    setInvoices(inv ?? []);
    setTickets(tk ?? []);
    setActivities(act ?? []);
    setNotes(n ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const addNote = async () => {
    if (!auth || !noteBody.trim() || !id) return;
    const res = await crudCreate("crm_notes", {
      customer_id: id,
      body: noteBody.trim(),
    });
    if (!res.ok) toast.error(res.error);
    else {
      setNoteBody("");
      toast.success("Note added");
      load();
    }
  };

  const addContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !id) return;
    const res = await crudCreate("crm_contacts", {
      customer_id: id,
      first_name: contactForm.first_name,
      last_name: contactForm.last_name || null,
      email: contactForm.email || null,
      phone: contactForm.phone || null,
      title: contactForm.title || null,
      is_primary: contacts.length === 0,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Contact added");
      setContactForm({ first_name: "", last_name: "", email: "", phone: "", title: "" });
      load();
    }
  };

  if (loading || !customer) return <LoadingState />;

  const outstanding = invoices
    .filter((i) => !["paid", "void", "cancelled"].includes(String(i.status)))
    .reduce(
      (s, i) => s + (Number(i.total_amount) - Number(i.amount_paid || 0)),
      0
    );

  return (
    <div>
      <PageHeader
        title={String(customer.name)}
        description={`360° CRM · ${String(customer.code)} · ${String(customer.customer_type || "account")}`}
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/crm/accounts">
              <Button variant="outline">All accounts</Button>
            </Link>
            <Link href="/dashboard/sales/quotations">
              <Button>New quotation</Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Credit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">
              UGX {formatNumber(Number(customer.credit_limit || 0))}
            </p>
            <StatusBadge status={String(customer.credit_status || "ok")} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Receivables</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">UGX {formatNumber(Math.round(outstanding))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{orders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Loyalty</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="capitalize">{String(customer.loyalty_level || "standard")}</Badge>
            <p className="text-sm mt-1">{Number(customer.loyalty_points || 0)} pts</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6 text-sm">
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">Industry / Territory</p>
          <p className="font-medium">
            {String(customer.industry || "—")} · {String(customer.territory || "—")}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">Contact</p>
          <p className="font-medium">
            {String(customer.phone || "—")} · {String(customer.email || "—")}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">Location</p>
          <p className="font-medium">
            {String(customer.city || "—")}, {String(customer.country || "Uganda")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="tickets">Service</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">Payment terms:</span> Net{" "}
            {String(customer.payment_terms_days || 30)} days ·{" "}
            {String(customer.currency || "UGX")}
          </p>
          <p>
            <span className="text-muted-foreground">Billing:</span>{" "}
            {String(customer.billing_address || customer.address || "—")}
          </p>
          <p>
            <span className="text-muted-foreground">Shipping:</span>{" "}
            {String(customer.shipping_address || "—")}
          </p>
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <form onSubmit={addContact} className="grid sm:grid-cols-5 gap-2 mb-4">
            <Input
              placeholder="First name"
              required
              value={contactForm.first_name}
              onChange={(e) =>
                setContactForm({ ...contactForm, first_name: e.target.value })
              }
            />
            <Input
              placeholder="Last name"
              value={contactForm.last_name}
              onChange={(e) =>
                setContactForm({ ...contactForm, last_name: e.target.value })
              }
            />
            <Input
              placeholder="Title"
              value={contactForm.title}
              onChange={(e) =>
                setContactForm({ ...contactForm, title: e.target.value })
              }
            />
            <Input
              placeholder="Email"
              value={contactForm.email}
              onChange={(e) =>
                setContactForm({ ...contactForm, email: e.target.value })
              }
            />
            <Button type="submit">Add contact</Button>
          </form>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={String(c.id)}>
                    <TableCell className="font-medium">
                      {String(c.first_name)} {String(c.last_name || "")}
                      {c.is_primary ? (
                        <Badge className="ml-2 text-[10px]" variant="secondary">
                          Primary
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{String(c.title || "—")}</TableCell>
                    <TableCell>{String(c.email || "—")}</TableCell>
                    <TableCell>{String(c.phone || c.mobile || "—")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={String(o.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(o.order_number)}
                    </TableCell>
                    <TableCell>{formatDate(String(o.order_date))}</TableCell>
                    <TableCell>
                      UGX {formatNumber(Number(o.total_amount || 0))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(o.status)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((i) => (
                  <TableRow key={String(i.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(i.invoice_number)}
                    </TableCell>
                    <TableCell>
                      UGX {formatNumber(Number(i.total_amount || 0))}
                    </TableCell>
                    <TableCell>
                      UGX {formatNumber(Number(i.amount_paid || 0))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(i.status)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="activities" className="mt-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((a) => (
                  <TableRow key={String(a.id)}>
                    <TableCell className="capitalize">
                      {String(a.activity_type).replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>{String(a.subject)}</TableCell>
                    <TableCell className="text-xs">
                      {a.scheduled_at
                        ? formatDate(String(a.scheduled_at))
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(a.status)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Link href="/dashboard/crm/activities" className="text-sm text-primary mt-2 inline-block">
            Schedule activity →
          </Link>
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => (
                  <TableRow key={String(t.id)}>
                    <TableCell className="font-mono text-xs">
                      {String(t.ticket_number)}
                    </TableCell>
                    <TableCell>{String(t.subject)}</TableCell>
                    <TableCell className="capitalize">{String(t.priority)}</TableCell>
                    <TableCell>
                      <StatusBadge status={String(t.status)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Link href="/dashboard/crm/service" className="text-sm text-primary mt-2 inline-block">
            Service desk →
          </Link>
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Add account note…"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
            />
            <Button onClick={addNote} disabled={!noteBody.trim()}>
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={String(n.id)} className="rounded-lg border p-3 text-sm">
                <p>{String(n.body)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDate(String(n.created_at))}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
