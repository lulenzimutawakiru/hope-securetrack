"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function AssetsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    asset_code: "",
    asset_name: "",
    category: "Plant & Machinery",
    acquisition_cost: "",
    residual_value: "0",
    useful_life_months: "60",
    location: "",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("fixed_assets")
      .select("*")
      .is("deleted_at", null)
      .order("asset_code");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const cost = Number(form.acquisition_cost);
    const residual = Number(form.residual_value || 0);
    const supabase = createClient();
    const crudRes4 = await crudCreate("fixed_assets", {
      company_id: auth.profile.company_id,
      asset_code: form.asset_code,
      asset_name: form.asset_name,
      category: form.category,
      location: form.location || null,
      purchase_date: new Date().toISOString().slice(0, 10),
      acquisition_cost: cost,
      residual_value: residual,
      useful_life_months: Number(form.useful_life_months),
      depreciation_method: "straight_line",
      book_value: cost,
      accumulated_depreciation: 0,
      status: "active",
      created_by: auth.profile.id,
    });
    if (!crudRes4.ok) toast.error(crudRes4.error);
    else {
      toast.success("Asset registered");
      setOpen(false);
      load();
    }
  };

  const depreciate = async (r: Record<string, unknown>) => {
    const cost = Number(r.acquisition_cost || 0);
    const residual = Number(r.residual_value || 0);
    const months = Number(r.useful_life_months || 1);
    const monthly = (cost - residual) / months;
    const accum = Number(r.accumulated_depreciation || 0) + monthly;
    const book = Math.max(cost - accum, residual);
    const supabase = createClient();
    const crudRes3 = await crudUpdate("fixed_assets", r.id as string, {
        accumulated_depreciation: accum,
        book_value: book,
      });
    if (!crudRes3.ok) {
      toast.error(crudRes3.error);
      return;
    }
    const crudRes2 = await crudCreate("depreciation_entries", {
      company_id: auth?.profile.company_id,
      asset_id: r.id,
      entry_date: new Date().toISOString().slice(0, 10),
      amount: monthly,
      method: "straight_line",
      notes: "Manual monthly depreciation",
    });
    toast.success(`Depreciated ${formatNumber(Math.round(monthly))} UGX`);
    load();
  };

  const dispose = async (id: string) => {
    if (!confirm("Mark asset as disposed?")) return;
    const supabase = createClient();
    const crudRes = await crudUpdate("fixed_assets", id, {
        status: "disposed",
        disposal_date: new Date().toISOString().slice(0, 10),
      });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Asset disposed");
      load();
    }
  };

  if (loading) return <LoadingState />;

  const nbv = rows
    .filter((r) => r.status === "active")
    .reduce((s, r) => s + Number(r.book_value || 0), 0);

  return (
    <div>
      <PageHeader
        title="Fixed Assets"
        description="Register · capitalize · depreciate · transfer · dispose · QR ready"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/finance">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add asset
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>Register fixed asset</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Code</Label>
                      <Input
                        value={form.asset_code}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, asset_code: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Input
                        value={form.category}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, category: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={form.asset_name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, asset_name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label>Cost</Label>
                      <Input
                        type="number"
                        value={form.acquisition_cost}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            acquisition_cost: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Residual</Label>
                      <Input
                        type="number"
                        value={form.residual_value}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            residual_value: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Life (mo)</Label>
                      <Input
                        type="number"
                        value={form.useful_life_months}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            useful_life_months: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Location</Label>
                    <Input
                      value={form.location}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, location: e.target.value }))
                      }
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Register</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Assets" value={formatNumber(rows.length)} icon={Package} />
        <StatCard title="Active NBV" value={formatNumber(Math.round(nbv))} />
        <StatCard
          title="Disposed"
          value={formatNumber(rows.filter((r) => r.status === "disposed").length)}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Package} title="No assets" description="Register plant, vehicles, equipment" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Purchased</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Accum. depr</TableHead>
                <TableHead className="text-right">NBV</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">
                    {String(r.asset_code)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {String(r.asset_name)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {String(r.category ?? "—")}
                  </TableCell>
                  <TableCell>
                    {r.purchase_date
                      ? formatDate(String(r.purchase_date))
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.acquisition_cost))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.accumulated_depreciation))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(Number(r.book_value))}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={String(r.status)} />
                  </TableCell>
                  <TableCell className="space-x-1">
                    {r.status === "active" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => depreciate(r)}
                        >
                          Depreciate
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => dispose(String(r.id))}
                        >
                          Dispose
                        </Button>
                      </>
                    )}
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
