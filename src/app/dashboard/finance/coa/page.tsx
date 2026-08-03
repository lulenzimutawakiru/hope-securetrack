"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
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
import {
  type DataGridColumn,
} from "@/components/enterprise/data-grid";
import { PaginatedDataGrid } from "@/components/enterprise/paginated-data-grid";
import { useEntityList, useCrudMutation } from "@/hooks/use-entity-query";
import { toast } from "sonner";

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

const EMPTY_FORM = {
  account_code: "",
  account_name: "",
  account_type: "asset",
  normal_balance: "debit",
  reporting_group: "Balance Sheet",
  is_postable: true,
};

export default function CoaPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Reads flow through the hardened CRUD API: tenant/company are derived
  // server-side, list rows are permission-checked and paginated.
  const { data, isPending, error } = useEntityList<CoaRow>("chart_of_accounts", {
    page,
    pageSize,
    sort: "account_code",
    includeDeleted: showArchived || undefined,
  });

  // Writes flow through the same API; lifecycle fields (company_id, tenant_id,
  // created_by) are stripped and re-derived server-side.
  const crud = useCrudMutation<CoaRow>("chart_of_accounts");

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      account_name: form.account_name,
      account_type: form.account_type,
      normal_balance: form.normal_balance,
      reporting_group: form.reporting_group,
      is_postable: form.is_postable,
    };
    const res = editId
      ? await crud.update(editId, payload)
      : await crud.create({
          ...payload,
          account_code: form.account_code,
          is_active: true,
        });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(editId ? "Account updated" : "Account created");
      setOpen(false);
      resetForm();
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

  const archiveOne = useCallback(async (id: string) => {
    if (!confirm("Archive this account?")) return;
    const res = await crud.remove(id);
    if (!res.ok) toast.error(res.error);
    else toast.success("Archived");
  }, [crud]);

  const restoreOne = useCallback(async (id: string) => {
    const res = await crud.restore(id);
    if (!res.ok) toast.error(res.error);
    else toast.success("Restored");
  }, [crud]);

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
    [archiveOne, restoreOne]
  );

  if (isPending) return null;

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

      <PaginatedDataGrid
        rows={rows}
        columns={columns}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={isPending}
        error={error}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        storageKey="grid:coa"
        height={520}
        exportFilename="chart-of-accounts"
        emptyMessage="No accounts — create COA entries"
        bulkArchive={async (selected) => {
          const ids = selected.filter((r) => !r.deleted_at).map((r) => r.id);
          if (!ids.length) return;
          if (!confirm(`Archive ${ids.length} account(s)?`)) return;
          await Promise.all(ids.map((id) => crud.remove(id)));
          toast.success(`Archived ${ids.length}`);
        }}
        bulkRestore={async (selected) => {
          const ids = selected.filter((r) => r.deleted_at).map((r) => r.id);
          if (!ids.length) return;
          await Promise.all(ids.map((id) => crud.restore(id)));
          toast.success(`Restored ${ids.length}`);
        }}
      />
      <p className="text-caption flex items-center gap-1">
        <Layers className="h-3 w-3" />
        Virtual scroll activates above 40 rows · pin columns · save filter presets in browser
      </p>
    </div>
  );
}
