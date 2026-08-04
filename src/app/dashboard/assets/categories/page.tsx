"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
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
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudList } from "@/lib/api/crud-client";
import { ASSET_DOMAINS } from "@/lib/assets";

export default function AssetCategoriesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    category_code: "",
    name: "",
    domain: "it",
    type_code: "GEN",
    prefix_template: "HDG-{DOM}-{TYPE}-{SEQ}",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const res = await crudList<Record<string, unknown>>("ast_categories", {
      page: 1,
      pageSize: 100,
      sort: "category_code",
      order: "asc",
    });
    setRows(res.ok ? res.data.data : []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const crudRes = await crudCreate("ast_categories", {
        company_id: companyId,
        category_code: form.category_code.toUpperCase(),
        name: form.name,
        domain: form.domain,
        type_code: form.type_code.toUpperCase(),
        prefix_template: form.prefix_template,
        is_active: true,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Category created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading categories…" />;

  return (
    <div>
      <PageHeader
        title="Asset Categories"
        description="Unlimited categories · domain · type code · tag prefix"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add category</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.category_code}
                        onChange={(e) => setForm((f) => ({ ...f, category_code: e.target.value }))}
                        placeholder="IT-LAP" />
                    </div>
                    <div>
                      <Label>Type code</Label>
                      <Input required value={form.type_code}
                        onChange={(e) => setForm((f) => ({ ...f, type_code: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Domain</Label>
                    <Select value={form.domain} onValueChange={(v) => setForm((f) => ({ ...f, domain: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASSET_DOMAINS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Prefix template</Label>
                    <Input value={form.prefix_template}
                      onChange={(e) => setForm((f) => ({ ...f, prefix_template: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No categories" description="Seed migration creates IT/MFG defaults." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.category_code)}</TableCell>
                  <TableCell className="font-medium">{String(r.name)}</TableCell>
                  <TableCell className="uppercase text-xs">{String(r.domain)}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.type_code)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{String(r.prefix_template || "—")}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_active ? "default" : "outline"} className="text-[10px]">
                      {r.is_active ? "Yes" : "No"}
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
