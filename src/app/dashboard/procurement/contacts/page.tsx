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
import { listContacts, createContact, listSuppliers } from "@/lib/srm";
import { toast } from "sonner";

export default function SrmContactsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    supplier_id: "",
    first_name: "",
    last_name: "",
    role_title: "",
    contact_role: "sales",
    email: "",
    mobile: "",
  });

  const load = async () => {
    try {
      const [c, s] = await Promise.all([listContacts(), listSuppliers({ limit: 100 })]);
      setRows(c);
      setSuppliers(s);
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
    if (!auth || !form.supplier_id) return;
    try {
      await createContact({
        company_id: auth.profile.company_id,
        supplier_id: form.supplier_id,
        first_name: form.first_name,
        last_name: form.last_name,
        role_title: form.role_title,
        contact_role: form.contact_role,
        email: form.email,
        mobile: form.mobile,
      });
      toast.success("Contact added");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading contacts…" />;

  const supName = (id: unknown) => {
    const s = suppliers.find((x) => x.id === id);
    return s ? String(s.name) : "—";
  };

  return (
    <div>
      <PageHeader
        title="Supplier Contacts"
        description="Sales · KAM · technical · finance · AR · MD · operations · emergency"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement/suppliers">Suppliers</Link>
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
                      <Label>Supplier</Label>
                      <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={String(s.id)} value={String(s.id)}>{String(s.name)}</SelectItem>
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
                        <Label>Role</Label>
                        <Select value={form.contact_role} onValueChange={(v) => setForm({ ...form, contact_role: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["sales", "kam", "technical", "finance", "ar", "md", "operations", "emergency"].map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Title</Label>
                        <Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} />
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
                  </div>
                  <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Contact} title="No contacts" description="Add multi-role supplier contacts." />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-medium">
                    {String(r.first_name)} {String(r.last_name || "")}
                    {r.is_primary ? <Badge className="ml-2 text-[10px]" variant="secondary">Primary</Badge> : null}
                  </TableCell>
                  <TableCell className="text-sm">{supName(r.supplier_id)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] uppercase">{String(r.contact_role)}</Badge></TableCell>
                  <TableCell className="text-sm">{String(r.role_title || "—")}</TableCell>
                  <TableCell className="text-sm">{String(r.email || "—")}</TableCell>
                  <TableCell className="text-sm">{String(r.mobile || r.phone || "—")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
