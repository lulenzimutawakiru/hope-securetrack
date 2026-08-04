"use client";

import { useEffect, useState } from "react";
import { Layers, Plus, Eye } from "lucide-react";
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
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { DOCUMENT_TYPES, defaultCanvas, nextPrtCode, previewTemplate } from "@/lib/print";

export default function PrintTemplatesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "label",
    document_type: "qr_auth",
    width_mm: "50",
    height_mm: "30",
    security_enabled: true,
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("prt_templates")
      .select("*")
      .is("deleted_at", null)
      .order("name");
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const template_code = await nextPrtCode(companyId, "prt_templates", "TPL");
      const w = Number(form.width_mm) || 50;
      const h = Number(form.height_mm) || 30;
      const crudRes = await crudCreate("prt_templates", {
        company_id: companyId,
        template_code,
        name: form.name,
        category: form.category,
        document_type: form.document_type,
        width_mm: w,
        height_mm: h,
        layout_json: defaultCanvas(w, h),
        security_enabled: form.security_enabled,
        status: "published",
        version: 1,
        created_by: auth?.user?.id,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Template created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const showPreview = async (id: string) => {
    try {
      const html = await previewTemplate(id);
      setPreview(html);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    }
  };

  if (loading) return <LoadingState message="Loading templates…" />;

  return (
    <div>
      <PageHeader
        title="Print Templates"
        description="QR labels · shipping · shelf · ID cards · documents"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New template</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Create template</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Document type</Label>
                    <Select value={form.document_type} onValueChange={(v) => setForm((f) => ({ ...f, document_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((d) => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Width mm</Label>
                      <Input value={form.width_mm} onChange={(e) => setForm((f) => ({ ...f, width_mm: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Height mm</Label>
                      <Input value={form.height_mm} onChange={(e) => setForm((f) => ({ ...f, height_mm: e.target.value }))} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.security_enabled} onChange={(e) => setForm((f) => ({ ...f, security_enabled: e.target.checked }))} />
                    Security enabled
                  </label>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Layers} title="No templates" description="Apply migration seed or create templates." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.template_code)}</TableCell>
                  <TableCell className="font-medium text-sm">
                    {String(r.name)}
                    {Boolean(r.is_default) && <Badge variant="outline" className="ml-2 text-[10px]">default</Badge>}
                  </TableCell>
                  <TableCell className="text-xs capitalize">{String(r.document_type)}</TableCell>
                  <TableCell className="text-xs">{String(r.width_mm)}×{String(r.height_mm)} mm</TableCell>
                  <TableCell>
                    <Badge variant="outline">{String(r.status)}</Badge>
                    {Boolean(r.security_enabled) && <Badge className="ml-1 text-[10px]" variant="secondary">SEC</Badge>}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => showPreview(String(r.id))}>
                      <Eye className="h-3 w-3 mr-1" /> Preview
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Template preview</DialogTitle></DialogHeader>
          {preview && <iframe title="Preview" srcDoc={preview} className="w-full h-[400px] rounded border bg-white" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
