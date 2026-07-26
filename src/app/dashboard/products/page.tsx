"use client";

import { useEffect, useState } from "react";
import { Plus, Box } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import type { Product, ProductCategory } from "@/types/database";

export default function ProductsPage() {
  const { auth, hasPermission } = useUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
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
    const [{ data }, { data: cats }] = await Promise.all([
      supabase
        .from("products")
        .select("*, product_categories(name, code)")
        .order("name"),
      supabase.from("product_categories").select("*").eq("is_active", true),
    ]);
    setProducts((data as Product[]) ?? []);
    setCategories((cats as ProductCategory[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

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

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Products"
        description="Paper products catalog for Hope Design Group"
        actions={
          hasPermission("products.manage") && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
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
          )
        }
      />

      {products.length === 0 ? (
        <EmptyState icon={Box} title="No products" description="Add your first product" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>GSM</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm">{p.product_code}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    {p.product_categories?.name ?? "—"}
                  </TableCell>
                  <TableCell>{p.paper_size}</TableCell>
                  <TableCell>{p.gsm}</TableCell>
                  <TableCell>{p.color}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Active" : "Inactive"}
                    </Badge>
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
