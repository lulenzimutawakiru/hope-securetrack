"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Contact } from "lucide-react";
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
import { useUser } from "@/hooks/use-user";
import { listContacts, createContact, listCustomers } from "@/lib/crm";
import { toast } from "sonner";

export default function CrmContactsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    first_name: "",
    last_name: "",
    title: "",
    department: "",
    email: "",
    phone: "",
    mobile: "",
    is_decision_maker: false,
  });

  const load = async () => {
    try {
      const [c, cust] = await Promise.all([listContacts(), listCustomers({ limit: 150 })]);
      setRows(c);
      setCustomers(cust);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !form.customer_id) return;
    try {
      await createContact({
        company_id: auth.profile.company_id,
        customer_id: form.customer_id,
        first_name: form.first_name,
        last_name: form.last_name,
        title: form.title,
        department: form.department,
        email: form.email,
        phone: form.phone,
        mobile: form.mobile,
        is_decision_maker: form.is_decision_maker,
        is_primary: false,
      });
      toast.success("Contact added");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  };

  if (loading) return <LoadingState message="Loading contacts…" />;

  const custName = (id: unknown) => {
    const c = customers.find((x) => x.id === id);
    return c ? String(c.name) : "—";
  };

  return (
    <div>
      <PageHeader
        title="Contact Management"
        description="Unlimited contacts · decision makers · finance · procurement · consent"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/crm/accounts">Accounts</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add contact</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>New contact</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Account</Label>
                      <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Customer" /></SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={String(c.id)} value={String(c.id)}>{String(c.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>First name</Label>
                        <Input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                      </div>
                      <div>
                        <Label>Last name</Label>
                        <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Title</Label>
                        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                      </div>
                      <div>
                        <Label>Department</Label>
                        <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Email</Label>
                        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                      </div>
                      <div>
                        <Label>Mobile</Label>
                        <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.is_decision_maker}
                        onChange={(e) => setForm({ ...form, is_decision_maker: e.target.checked })}
                      />
                      Decision maker
                    </label>
                  </div>
                  <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Contact} title="No contacts" description="Add contacts to customer accounts." />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Roles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-medium">
                    {String(r.first_name)} {String(r.last_name || "")}
                    {r.is_primary ? <Badge className="ml-2 text-[10px]" variant="secondary">Primary</Badge> : null}
                  </TableCell>
                  <TableCell className="text-sm">{custName(r.customer_id)}</TableCell>
                  <TableCell className="text-sm">{String(r.title || "—")}</TableCell>
                  <TableCell className="text-sm">{String(r.email || "—")}</TableCell>
                  <TableCell className="text-sm">{String(r.mobile || r.phone || "—")}</TableCell>
                  <TableCell className="space-x-1">
                    {r.is_decision_maker ? <Badge variant="outline" className="text-[10px]">DM</Badge> : null}
                    {r.is_finance ? <Badge variant="outline" className="text-[10px]">Finance</Badge> : null}
                    {r.is_procurement ? <Badge variant="outline" className="text-[10px]">Proc</Badge> : null}
                    {r.is_technical ? <Badge variant="outline" className="text-[10px]">Tech</Badge> : null}
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
