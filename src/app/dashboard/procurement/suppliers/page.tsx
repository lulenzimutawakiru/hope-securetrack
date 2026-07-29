"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import {
  EnterpriseDataGrid,
  type DataGridColumn,
} from "@/components/enterprise/data-grid";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

type SupplierRow = {
  id: string;
  code: string;
  name: string;
  category?: string | null;
  country?: string | null;
  email?: string | null;
  contact_person?: string | null;
  on_time_delivery_pct?: number | null;
  quality_score?: number | null;
  risk_score?: number | null;
  overall_score?: number | null;
  is_approved_vendor?: boolean | null;
  is_active?: boolean | null;
};

export default function SuppliersPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "raw_materials",
    email: "",
    phone: "",
    country: "Uganda",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("suppliers")
      .select("*")
      .order("name")
      .limit(500);
    setRows((data as SupplierRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const { error } = await supabase.from("suppliers").insert({
      company_id: auth.profile.company_id,
      code: form.code,
      name: form.name,
      category: form.category,
      email: form.email || null,
      phone: form.phone || null,
      country: form.country,
      is_approved_vendor: false,
      is_active: true,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Supplier created");
      setOpen(false);
      load();
    }
  };

  const columns = useMemo<DataGridColumn<SupplierRow>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        defaultPinned: "left",
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{String(getValue())}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.email ?? row.original.contact_person ?? ""}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ getValue }) => (
          <span className="capitalize text-sm">
            {String(getValue() ?? "—").replace(/_/g, " ")}
          </span>
        ),
      },
      { accessorKey: "country", header: "Country" },
      {
        accessorKey: "on_time_delivery_pct",
        header: "OTD %",
        cell: ({ getValue }) => `${formatNumber(Number(getValue() ?? 0))}%`,
      },
      {
        accessorKey: "quality_score",
        header: "Quality",
        cell: ({ getValue }) => formatNumber(Number(getValue() ?? 0)),
      },
      {
        accessorKey: "risk_score",
        header: "Risk",
        cell: ({ getValue }) => {
          const n = Number(getValue() ?? 0);
          return (
            <Badge
              variant="outline"
              className={
                n >= 60
                  ? "border-red-300 text-red-700"
                  : n >= 40
                    ? "border-amber-300 text-amber-700"
                    : "border-green-300 text-green-700"
              }
            >
              {String(getValue() ?? "—")}
            </Badge>
          );
        },
      },
      {
        accessorKey: "overall_score",
        header: "Score",
        cell: ({ getValue }) => (
          <span className="font-medium">{formatNumber(Number(getValue() ?? 0))}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (r) => (r.is_approved_vendor ? "approved" : "pending"),
        cell: ({ row }) =>
          row.original.is_approved_vendor ? (
            <Badge className="bg-green-100 text-green-800">Approved</Badge>
          ) : (
            <Badge variant="secondary">Pending</Badge>
          ),
      },
    ],
    []
  );

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        description="Enterprise grid · vendor master · risk · OTD · export"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/procurement">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add supplier
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New supplier</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Code</Label>
                      <Input
                        value={form.code}
                        onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Input
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <EnterpriseDataGrid
        data={rows}
        columns={columns}
        storageKey="grid:suppliers"
        height={520}
        exportFilename="suppliers"
        emptyMessage="No suppliers — add approved vendors"
      />
      <p className="text-caption flex items-center gap-1">
        <Users className="h-3 w-3" />
        Pin Code column · save filter presets · bulk export CSV
      </p>
    </div>
  );
}
