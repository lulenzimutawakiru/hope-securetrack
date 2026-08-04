"use client";

import { useEffect, useState } from "react";
import { Users, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { ENTITY_TYPES } from "@/lib/billing";

type Cust = {
  id: string;
  code: string;
  name: string;
  customer_type: string | null;
  entity_type?: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  vat_number?: string | null;
  currency?: string | null;
  credit_limit: number;
  credit_rating?: string | null;
  payment_terms_days: number;
  price_list_code?: string | null;
  account_manager?: string | null;
  is_active: boolean;
  city: string | null;
  country: string | null;
};

export default function BillingCustomersPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Cust[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    entity_type: "company",
    contact_person: "",
    email: "",
    phone: "",
    tax_id: "",
    vat_number: "",
    currency: "UGX",
    credit_limit: "0",
    credit_rating: "B",
    payment_terms_days: "30",
    account_manager: "",
    billing_address: "",
    city: "Kampala",
    country: "Uganda",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("customers").select("*").order("name").limit(500);
    setRows((data as Cust[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const code = form.code || `CUS-${String(rows.length + 1).padStart(4, "0")}`;
      const crudRes = await crudCreate("customers", {
        company_id: auth.profile.company_id,
        code,
        name: form.name,
        customer_type: form.entity_type === "retail" ? "retail" : "wholesale",
        entity_type: form.entity_type,
        contact_person: form.contact_person || null,
        email: form.email || null,
        phone: form.phone || null,
        tax_id: form.tax_id || null,
        vat_number: form.vat_number || null,
        currency: form.currency,
        credit_limit: Number(form.credit_limit) || 0,
        credit_rating: form.credit_rating,
        payment_terms_days: Number(form.payment_terms_days) || 30,
        account_manager: form.account_manager || null,
        billing_address: form.billing_address || null,
        city: form.city || null,
        country: form.country || "Uganda",
        is_active: true,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Customer billing profile created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading customers…" />;

  return (
    <div>
      <PageHeader
        title="Customer Billing Profiles"
        description="Companies · government · distributors · credit limits · tax IDs · price lists"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New customer</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Billing customer</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="Auto if empty" /></div>
                  <div>
                    <Label>Entity type</Label>
                    <Select value={form.entity_type} onValueChange={(v) => setForm((f) => ({ ...f, entity_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ENTITY_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Company / name *</Label><Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Contact</Label><Input value={form.contact_person} onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
                </div>
                <div><Label>Email / billing email</Label><Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Tax / TIN</Label><Input value={form.tax_id} onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))} /></div>
                  <div><Label>VAT number</Label><Input value={form.vat_number} onChange={(e) => setForm((f) => ({ ...f, vat_number: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Currency</Label>
                    <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["UGX", "USD", "KES"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Credit limit</Label><Input type="number" value={form.credit_limit} onChange={(e) => setForm((f) => ({ ...f, credit_limit: e.target.value }))} /></div>
                  <div><Label>Terms days</Label><Input type="number" value={form.payment_terms_days} onChange={(e) => setForm((f) => ({ ...f, payment_terms_days: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Credit rating</Label><Input value={form.credit_rating} onChange={(e) => setForm((f) => ({ ...f, credit_rating: e.target.value }))} /></div>
                  <div><Label>Account manager</Label><Input value={form.account_manager} onChange={(e) => setForm((f) => ({ ...f, account_manager: e.target.value }))} /></div>
                </div>
                <div><Label>Billing address</Label><Input value={form.billing_address} onChange={(e) => setForm((f) => ({ ...f, billing_address: e.target.value }))} /></div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Customers" value={String(rows.length)} icon={Users} />
        <StatCard title="Active" value={String(rows.filter((r) => r.is_active).length)} icon={Users} />
        <StatCard title="Total credit limits" value={formatNumber(rows.reduce((s, r) => s + Number(r.credit_limit || 0), 0))} icon={Users} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No customers" description="Create a billing profile to issue invoices." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tax / VAT</TableHead>
                <TableHead>Terms</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.contact_person || r.email || "—"}</div>
                  </TableCell>
                  <TableCell className="text-xs">{r.entity_type || r.customer_type || "—"}</TableCell>
                  <TableCell className="text-xs">{r.tax_id || "—"} / {r.vat_number || "—"}</TableCell>
                  <TableCell className="text-xs">Net {r.payment_terms_days}</TableCell>
                  <TableCell className="text-xs">{formatNumber(r.credit_limit)} {r.currency || "UGX"}</TableCell>
                  <TableCell className="text-xs">{r.credit_rating || "—"}</TableCell>
                  <TableCell><StatusBadge status={r.is_active ? "active" : "inactive"} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
