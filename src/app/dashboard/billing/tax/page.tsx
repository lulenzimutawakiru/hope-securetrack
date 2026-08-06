"use client";

import { useEffect, useState } from "react";
import { Percent, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { formatNumber } from "@/lib/utils";

export default function BillingTaxPage() {
  const { auth } = useUser();
  const [codes, setCodes] = useState<Array<Record<string, unknown>>>([]);
  const [groups, setGroups] = useState<Array<Record<string, unknown>>>([]);
  const [taxReport, setTaxReport] = useState({ taxable: 0, tax: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tax_code: "",
    name: "",
    tax_type: "vat",
    rate: "18",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: c }, { data: g }, { data: inv }] = await Promise.all([
      supabase.from("bill_tax_codes").select("*").order("tax_code"),
      supabase.from("bill_tax_groups").select("*"),
      supabase
        .from("invoices")
        .select("subtotal,tax_amount,discount_amount,status")
        .not("status", "in", '("void","cancelled","draft")')
        .limit(2000),
    ]);
    setCodes(c ?? []);
    setGroups(g ?? []);
    const list = inv || [];
    setTaxReport({
      taxable: list.reduce((s, i) => s + Number(i.subtotal) - Number(i.discount_amount || 0), 0),
      tax: list.reduce((s, i) => s + Number(i.tax_amount || 0), 0),
      count: list.length,
    });
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    try {
      const crudRes = await crudCreate("bill_tax_codes", {
        company_id: auth.profile.company_id,
        tax_code: form.tax_code.toUpperCase(),
        name: form.name,
        tax_type: form.tax_type,
        rate: Number(form.rate),
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Tax code created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading tax configuration…" />;

  return (
    <div>
      <PageHeader
        title="Tax Management"
        description="VAT · sales tax · withholding · excise · zero-rated · exemptions · audit"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Tax code</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New tax code</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div><Label>Code</Label><Input required value={form.tax_code} onChange={(e) => setForm((f) => ({ ...f, tax_code: e.target.value }))} placeholder="VAT18" /></div>
                <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.tax_type} onValueChange={(v) => setForm((f) => ({ ...f, tax_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["vat", "sales_tax", "withholding", "excise", "local", "international", "zero", "exempt"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Rate %</Label><Input type="number" step="0.01" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} /></div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Invoices (posted)</p><p className="text-2xl font-bold">{taxReport.count}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Taxable base</p><p className="text-2xl font-bold">{formatNumber(Math.round(taxReport.taxable))}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tax collected</p><p className="text-2xl font-bold">{formatNumber(Math.round(taxReport.tax))}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Percent className="h-4 w-4" /> Tax codes</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((c) => (
                  <TableRow key={String(c.id)}>
                    <TableCell className="font-mono text-xs">{String(c.tax_code)}</TableCell>
                    <TableCell className="text-sm">{String(c.name)}</TableCell>
                    <TableCell><Badge variant="outline">{String(c.tax_type)}</Badge></TableCell>
                    <TableCell>{Number(c.rate)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Tax groups</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {groups.map((g) => (
              <div key={String(g.id)} className="rounded border p-3">
                <div className="font-medium text-sm flex items-center gap-2">
                  {String(g.name)}
                  {g.is_default ? <Badge>Default</Badge> : null}
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-1">{String(g.group_code)}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {((g.tax_codes as string[]) || []).map((t) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
