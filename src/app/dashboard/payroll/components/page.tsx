"use client";

import { useEffect, useState } from "react";
import { Calculator, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { crudCreate } from "@/lib/api/crud-client";
import { toast } from "sonner";

export default function PayComponentsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    component_code: "",
    name: "",
    component_type: "earning",
    category: "allowance",
    is_taxable: true,
    is_statutory: false,
  });

  const load = async () => {
    const { data } = await createClient()
      .from("pay_components")
      .select("*")
      .order("sort_order");
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await crudCreate("pay_components", {
      component_code: form.component_code.toUpperCase(),
      name: form.name,
      component_type: form.component_type,
      category: form.category,
      is_taxable: form.is_taxable,
      is_statutory: form.is_statutory,
      is_active: true,
      sort_order: rows.length + 1,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Component created");
      setOpen(false);
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading components…" />;

  return (
    <div>
      <PageHeader
        title="Pay Components"
        description="Earnings · deductions · tax · employer contributions"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add component</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>New pay component</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.component_code} onChange={(e) => setForm((f) => ({ ...f, component_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Type</Label>
                      <Select value={form.component_type} onValueChange={(v) => setForm((f) => ({ ...f, component_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="earning">Earning</SelectItem>
                          <SelectItem value="deduction">Deduction</SelectItem>
                          <SelectItem value="tax">Tax</SelectItem>
                          <SelectItem value="employer">Employer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="allowance">Allowance</SelectItem>
                          <SelectItem value="bonus">Bonus</SelectItem>
                          <SelectItem value="overtime">Overtime</SelectItem>
                          <SelectItem value="statutory">Statutory</SelectItem>
                          <SelectItem value="loan">Loan</SelectItem>
                          <SelectItem value="benefit">Benefit</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={form.is_taxable} onChange={(e) => setForm((f) => ({ ...f, is_taxable: e.target.checked }))} />
                      Taxable
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={form.is_statutory} onChange={(e) => setForm((f) => ({ ...f, is_statutory: e.target.checked }))} />
                      Statutory
                    </label>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Calculator} title="No components" description="Seed migration adds default components, or create manually." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">{String(r.component_code)}</TableCell>
                  <TableCell className="font-medium">{String(r.name)}</TableCell>
                  <TableCell className="capitalize">{String(r.component_type)}</TableCell>
                  <TableCell className="capitalize text-sm">{String(r.category)}</TableCell>
                  <TableCell className="space-x-1">
                    {Boolean(r.is_taxable) && <Badge variant="outline" className="text-[10px]">Taxable</Badge>}
                    {Boolean(r.is_statutory) && <Badge variant="outline" className="text-[10px]">Statutory</Badge>}
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
