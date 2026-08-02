"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Layers, Plus, Pencil, Archive, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import {
  EnterpriseDataGrid,
  type DataGridColumn,
} from "@/components/enterprise/data-grid";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { softDeleteMany, restoreMany } from "@/lib/soft-delete";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "cost_of_sales",
  "operating_expense",
  "admin_expense",
  "manufacturing_overhead",
  "financial_income",
  "financial_expense",
  "tax",
  "memorandum",
];

type CoaRow = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  reporting_group: string | null;
  is_postable: boolean;
  is_active: boolean;
  deleted_at: string | null;
};

export default function CoaPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<CoaRow[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    account_code: "",
    account_name: "",
    account_type: "asset",
    normal_balance: "debit",
    reporting_group: "Balance Sheet",
    is_postable: true,
  });

  const load = async () => {
    const supabase = createClient();
    let q = supabase.from("chart_of_accounts").select("*").order("account_code");
    if (!showArchived) q = q.is("deleted_at", null);
    const { data } = await q;
    setRows((data as CoaRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const resetForm = () => {
    setForm({
      account_code: "",
      account_name: "",
      account_type: "asset",
      normal_balance: "debit",
      reporting_group: "Balance Sheet",
      is_postable: true,
    });
    setEditId(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    if (editId) {
      const crudRes2 = await crudUpdate("chart_of_accounts", editId, {
          account_name: form.account_name,
          account_type: form.account_type,
          normal_balance: form.normal_balance,
          reporting_group: form.reporting_group,
          is_postable: form.is_postable,
        });
      if (!crudRes2.ok) toast.error(crudRes2.error);
      else {
        toast.success("Account updated");
        setOpen(false);
        resetForm();
        load();
      }
    } else {
      const crudRes = await crudCreate("chart_of_accounts", {
        company_id: auth.profile.company_id,
        account_code: form.account_code,
        account_name: form.account_name,
        account_type: form.account_type,
        normal_balance: form.normal_balance,
        reporting_group: form.reporting_group,
        is_postable: form.is_postable,
        is_active: true,
        created_by: auth.profile.id,
      });
      if (!crudRes.ok) toast.error(crudRes.error);
      else {
        toast.success("Account created");
        setOpen(false);
        resetForm();
        load();
      }
    }
  };

  const openEdit = (r: CoaRow) => {
    setEditId(r.id);
    setForm({
      account_code: r.account_code,
      account_name: r.account_name,
      account_type: r.account_type,
      normal_balance: r.normal_balance || "debit",
      reporting_group: r.reporting_group || "Balance Sheet",
      is_postable: Boolean(r.is_postable),
    });
    setOpen(true);
  };

  const archiveOne = async (id: string) => {
    if (!confirm("Archive this account?")) return;
    const supabase = createClient();
    const { error } = await softDeleteMany(supabase, "chart_of_accounts", [id], {
      is_active: false,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Archived");
      load();
    }
  };

  const restoreOne = async (id: string) => {
    const supabase = createClient();
    const { error } = await restoreMany(supabase, "chart_of_accounts", [id], {
      is_active: true,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Restored");
      load();
    }
  };

  const columns = useMemo<DataGridColumn<CoaRow>[]>(
    () => [
      {
        accessorKey: "account_code",
        header: "Code",
        size: 100,
        defaultPinned: "left",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.account_code}</span>
        ),
      },
      {
        accessorKey: "account_name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.account_name}</span>
        ),
      },
      {
        accessorKey: "account_type",
        header: "Type",
        cell: ({ getValue }) => (
          <span className="capitalize text-sm">
            {String(getValue()).replace(/_/g, " ")}
          </span>
        ),
      },
      {
        accessorKey: "normal_balance",
        header: "Balance",
        cell: ({ getValue }) => (
          <span className="capitalize">{String(getValue())}</span>
        ),
      },
      {
        accessorKey: "reporting_group",
        header: "Group",
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        accessorKey: "is_postable",
        header: "Postable",
        cell: ({ getValue }) =>
          getValue() ? (
            <Badge variant="secondary">Yes</Badge>
          ) : (
            <Badge variant="outline">Header</Badge>
          ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (r) => (r.deleted_at ? "archived" : r.is_active ? "active" : "inactive"),
        cell: ({ row }) =>
          row.original.deleted_at ? (
            <Badge variant="outline">Archived</Badge>
          ) : row.original.is_active ? (
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex justify-end gap-1">
              {!r.deleted_at && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => archiveOne(r.id)}>
                    <Archive className="h-4 w-4" />
                  </Button>
                </>
              )}
              {r.deleted_at && (
                <Button size="sm" variant="ghost" onClick={() => restoreOne(r.id)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chart of Accounts"
        description="Enterprise grid · sort · filter · pin · bulk archive · export · recycle bin"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/finance">Hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/recycle-bin">
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Recycle bin
              </Link>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v);
                if (!v) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={save} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>
                      {editId ? "Edit account" : "Create account"}
                    </DialogTitle>
                  </DialogHeader>
                  {!editId && (
                    <div className="space-y-1">
                      <Label>Account code</Label>
                      <Input
                        value={form.account_code}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, account_code: e.target.value }))
                        }
                        required
                        className="font-mono"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label>Account name</Label>
                    <Input
                      value={form.account_name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, account_name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <Select
                        value={form.account_type}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, account_type: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Normal balance</Label>
                      <Select
                        value={form.normal_balance}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, normal_balance: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debit">Debit</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Reporting group</Label>
                    <Input
                      value={form.reporting_group}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, reporting_group: e.target.value }))
                      }
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">{editId ? "Save" : "Create"}</Button>
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
        storageKey="grid:coa"
        height={520}
        exportFilename="chart-of-accounts"
        emptyMessage="No accounts — create COA entries"
        bulkArchive={async (selected) => {
          const ids = selected.filter((r) => !r.deleted_at).map((r) => r.id);
          if (!ids.length) return;
          if (!confirm(`Archive ${ids.length} account(s)?`)) return;
          const supabase = createClient();
          const { error } = await softDeleteMany(supabase, "chart_of_accounts", ids, {
            is_active: false,
          });
          if (error) toast.error(error.message);
          else {
            toast.success(`Archived ${ids.length}`);
            load();
          }
        }}
        bulkRestore={async (selected) => {
          const ids = selected.filter((r) => r.deleted_at).map((r) => r.id);
          if (!ids.length) return;
          const supabase = createClient();
          const { error } = await restoreMany(supabase, "chart_of_accounts", ids, {
            is_active: true,
          });
          if (error) toast.error(error.message);
          else {
            toast.success(`Restored ${ids.length}`);
            load();
          }
        }}
      />
      <p className="text-caption flex items-center gap-1">
        <Layers className="h-3 w-3" />
        Virtual scroll activates above 40 rows · pin columns · save filter presets in browser
      </p>
    </div>
  );
}
