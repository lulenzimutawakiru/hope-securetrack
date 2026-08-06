"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scale, Plus } from "lucide-react";
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
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function TaxPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    tax_type: "vat",
    rate: "18",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("tax_codes")
      .select("*")
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
    const crudRes2 = await crudCreate("tax_codes", {
      company_id: auth.profile.company_id,
      code: form.code,
      name: form.name,
      tax_type: form.tax_type,
      rate: Number(form.rate),
      is_active: true,
    });
    if (!crudRes2.ok) toast.error(crudRes2.error);
    else {
      toast.success("Tax code created");
      setOpen(false);
      load();
    }
  };

  const toggle = async (id: string, is_active: boolean) => {
    const crudRes = await crudUpdate("tax_codes", id, { is_active: !is_active });
    if (!crudRes.ok) toast.error(crudRes.error);
    else load();
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Tax Management"
        description="VAT · WHT · PAYE · LST · NSSF codes · Uganda-ready rates"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/finance">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Tax code
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>New tax code</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Code</Label>
                      <Input
                        value={form.code}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, code: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Rate %</Label>
                      <Input
                        type="number"
                        step="any"
                        value={form.rate}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, rate: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Input
                      value={form.tax_type}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, tax_type: e.target.value }))
                      }
                      placeholder="vat | wht | paye | nssf | lst"
                    />
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
        <EmptyState icon={Scale} title="No tax codes" description="Configure VAT/WHT" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Rate %</TableHead>
                <TableHead>Recoverable</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">
                    {String(r.code)}
                  </TableCell>
                  <TableCell>{String(r.name)}</TableCell>
                  <TableCell className="uppercase text-sm">
                    {String(r.tax_type)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.rate))}
                  </TableCell>
                  <TableCell>
                    {r.is_recoverable ? (
                      <Badge variant="secondary">Yes</Badge>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.is_active ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        toggle(String(r.id), Boolean(r.is_active))
                      }
                    >
                      {r.is_active ? "Deactivate" : "Activate"}
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
