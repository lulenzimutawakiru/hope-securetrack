"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Box, Pencil, Archive, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import type { Product, ProductCategory } from "@/types/database";

type ProductRow = Product & { deleted_at?: string | null };

export default function ProductsPage() {
  const { auth, hasPermission } = useUser();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    product_code: "",
    paper_size: "A4",
    gsm: "80",
    color: "White",
    category_id: "",
  });

  const load = async () => {
    const supabase = createClient();
    let pq = supabase
      .from("products")
      .select("*, product_categories(name, code)")
      .order("name");
    if (!showArchived) pq = pq.is("deleted_at", null);
    const [{ data }, { data: cats }] = await Promise.all([
      pq,
      supabase.from("product_categories").select("*").eq("is_active", true),
    ]);
    setProducts((data as ProductRow[]) ?? []);
    setCategories((cats as ProductCategory[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("products").insert({
        company_id: auth.profile.company_id,
        name: form.name,
        product_code: form.product_code,
        paper_size: form.paper_size,
        gsm: parseInt(form.gsm, 10),
        color: form.color,
        category_id: form.category_id || null,
        reams_per_carton: 5,
        is_active: true,
      });
      if (error) throw error;
      toast.success("Product created");
      setOpen(false);
      setForm({
        name: "",
        product_code: "",
        paper_size: "A4",
        gsm: "80",
        color: "White",
        category_id: "",
      });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p: ProductRow) => {
    setEditing(p);
    setForm({
      name: p.name,
      product_code: p.product_code,
      paper_size: p.paper_size ?? "A4",
      gsm: String(p.gsm ?? 80),
      color: p.color ?? "White",
      category_id: p.category_id ?? "",
    });
    setEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("products")
        .update({
          name: form.name,
          product_code: form.product_code,
          paper_size: form.paper_size,
          gsm: parseInt(form.gsm, 10),
          color: form.color,
          category_id: form.category_id || null,
        })
        .eq("id", editing.id);
      if (error) throw error;
      toast.success("Product updated");
      setEditOpen(false);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<DataGridColumn<ProductRow>[]>(
    () => [
      {
        accessorKey: "product_code",
        header: "Code",
        defaultPinned: "left",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.product_code}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "category",
        header: "Category",
        accessorFn: (r) => r.product_categories?.name ?? "—",
      },
      { accessorKey: "paper_size", header: "Size" },
      { accessorKey: "gsm", header: "GSM" },
      { accessorKey: "color", header: "Color" },
      {
        id: "status",
        header: "Status",
        accessorFn: (r) =>
          r.deleted_at ? "archived" : r.is_active ? "active" : "inactive",
        cell: ({ row }) => {
          const p = row.original;
          if (p.deleted_at) return <Badge variant="outline">Archived</Badge>;
          return (
            <Badge variant={p.is_active ? "default" : "secondary"}>
              {p.is_active ? "Active" : "Inactive"}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const p = row.original;
          if (!hasPermission("products.manage") && !hasPermission("settings.manage"))
            return null;
          return (
            <div className="flex justify-end gap-1">
              {!p.deleted_at && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm(`Archive ${p.product_code}?`)) return;
                      const supabase = createClient();
                      const { error } = await softDeleteMany(
                        supabase,
                        "products",
                        [p.id],
                        { is_active: false }
                      );
                      if (error) toast.error(error.message);
                      else {
                        toast.success("Archived");
                        load();
                      }
                    }}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </>
              )}
              {p.deleted_at && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const supabase = createClient();
                    const { error } = await restoreMany(supabase, "products", [p.id], {
                      is_active: true,
                    });
                    if (error) toast.error(error.message);
                    else {
                      toast.success("Restored");
                      load();
                    }
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasPermission]
  );

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        description="Enterprise product master · grid · bulk archive · soft delete · export"
        actions={
          <div className="flex flex-wrap gap-2">
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
            {hasPermission("products.manage") && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreate}>
                    <DialogHeader>
                      <DialogTitle>Add Product</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Product Code</Label>
                        <Input
                          value={form.product_code}
                          onChange={(e) =>
                            setForm({ ...form, product_code: e.target.value })
                          }
                          required
                          className="font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label>Size</Label>
                          <Input
                            value={form.paper_size}
                            onChange={(e) =>
                              setForm({ ...form, paper_size: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>GSM</Label>
                          <Input
                            type="number"
                            value={form.gsm}
                            onChange={(e) => setForm({ ...form, gsm: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Color</Label>
                          <Input
                            value={form.color}
                            onChange={(e) => setForm({ ...form, color: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />

      <EnterpriseDataGrid
        data={products}
        columns={columns}
        storageKey="grid:products"
        height={520}
        exportFilename="products"
        emptyMessage="No products — add your first product"
        bulkArchive={async (selected) => {
          const ids = selected.filter((r) => !r.deleted_at).map((r) => r.id);
          if (!ids.length) return;
          if (!confirm(`Archive ${ids.length} product(s)?`)) return;
          const supabase = createClient();
          const { error } = await softDeleteMany(supabase, "products", ids, {
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
          const { error } = await restoreMany(supabase, "products", ids, {
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
        <Box className="h-3 w-3" />
        Soft-deleted products appear in Recycle Bin · hard delete disabled for audit safety
      </p>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Edit product</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Product Code</Label>
                <Input
                  value={form.product_code}
                  onChange={(e) =>
                    setForm({ ...form, product_code: e.target.value })
                  }
                  required
                  className="font-mono"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Input
                    value={form.paper_size}
                    onChange={(e) =>
                      setForm({ ...form, paper_size: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>GSM</Label>
                  <Input
                    type="number"
                    value={form.gsm}
                    onChange={(e) => setForm({ ...form, gsm: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
