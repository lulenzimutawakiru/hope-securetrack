"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitBranch, Plus, Archive } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

const BRANCH_TYPES = ["office", "factory", "warehouse", "dc", "sales"];

export default function BranchesSettingsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    country: "Uganda",
    phone: "",
    email: "",
    manager_name: "",
    branch_type: "office",
    currency: "UGX",
    tax_region: "",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("branches")
      .select("*")
      .is("deleted_at", null)
      .order("code");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const crudRes3 = await crudCreate("branches", {
        company_id: auth.profile.company_id,
        name: form.name,
        code: form.code,
        address: form.address || null,
        city: form.city || null,
        country: form.country || "Uganda",
        phone: form.phone || null,
        email: form.email || null,
        manager_name: form.manager_name || null,
        branch_type: form.branch_type,
        currency: form.currency || "UGX",
        tax_region: form.tax_region || null,
        is_active: true,
      });
    if (!crudRes3.ok) {
      toast.error(crudRes3.error);
      return;
    }
    const data = crudRes3.data as Record<string, unknown>;
    toast.success("Branch created");
    setOpen(false);
    setForm({
      name: "",
      code: "",
      address: "",
      city: "",
      country: "Uganda",
      phone: "",
      email: "",
      manager_name: "",
      branch_type: "office",
      currency: "UGX",
      tax_region: "",
    });
    load();
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    if (!auth) return;
    const crudRes2 = await crudUpdate("branches", id, { is_active: !is_active });
    if (!crudRes2.ok) toast.error(crudRes2.error);
    else {
      load();
    }
  };

  const archive = async (id: string) => {
    if (!auth) return;
    if (!confirm("Archive this branch? It can be restored from the database.")) return;
    const crudRes = await crudUpdate("branches", id, { deleted_at: new Date().toISOString(), is_active: false });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Branch archived");
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Branch Management"
        description="Branches · factories · warehouses · distribution centres · sales offices"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Branch
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>New branch / site</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Name</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Code</Label>
                      <Input
                        value={form.code}
                        onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.branch_type}
                        onChange={(e) => setForm((f) => ({ ...f, branch_type: e.target.value }))}
                      >
                        {BRANCH_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Currency</Label>
                      <Input
                        value={form.currency}
                        onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Address</Label>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>City</Label>
                      <Input
                        value={form.city}
                        onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Country</Label>
                      <Input
                        value={form.country}
                        onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Manager</Label>
                      <Input
                        value={form.manager_name}
                        onChange={(e) => setForm((f) => ({ ...f, manager_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Tax region</Label>
                      <Input
                        value={form.tax_region}
                        onChange={(e) => setForm((f) => ({ ...f, tax_region: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No branches"
          description="Create head office, factory, or DC sites"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">{String(r.code)}</TableCell>
                  <TableCell>{String(r.name)}</TableCell>
                  <TableCell className="capitalize text-sm">{String(r.branch_type ?? "office")}</TableCell>
                  <TableCell className="text-sm">{String(r.city ?? "—")}</TableCell>
                  <TableCell className="text-sm">{String(r.manager_name ?? "—")}</TableCell>
                  <TableCell className="text-sm">{String(r.currency ?? "UGX")}</TableCell>
                  <TableCell>
                    {r.is_active ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActive(String(r.id), Boolean(r.is_active))}
                    >
                      {r.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => archive(String(r.id))}
                      title="Archive"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
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
