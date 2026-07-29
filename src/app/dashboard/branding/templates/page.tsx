"use client";

import { useEffect, useState } from "react";
import { LayoutTemplate, Plus, Eye } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import {
  TEMPLATE_CATEGORIES, CANVAS_SIZES, createTemplate, renderTemplatePreview,
} from "@/lib/branding";

export default function BrandTemplatesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "finance",
    document_type: "invoice",
    canvas_size: "A4",
    header_html: '<div style="color:#0D7377;font-weight:700">{{company_name}}</div>',
    html_body: "<p>Document for {{customer_name}}</p>",
    footer_html: '<div style="font-size:10px">{{company_email}}</div>',
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("brand_templates")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
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
      await createTemplate({
        company_id: companyId,
        ...form,
        created_by: auth?.user?.id,
      });
      toast.success("Template created (draft)");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const showPreview = async (id: string) => {
    try {
      const html = await renderTemplatePreview(id);
      setPreview(html);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    }
  };

  if (loading) return <LoadingState message="Loading templates…" />;

  return (
    <div>
      <PageHeader
        title="Document Templates"
        description="Finance · procurement · HR · sales · production · email"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New template</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Create template</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Category</Label>
                      <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TEMPLATE_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Canvas</Label>
                      <Select value={form.canvas_size} onValueChange={(v) => setForm((f) => ({ ...f, canvas_size: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CANVAS_SIZES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Document type</Label>
                    <Input value={form.document_type} onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Header HTML</Label>
                    <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono" value={form.header_html} onChange={(e) => setForm((f) => ({ ...f, header_html: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Body HTML</Label>
                    <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono" value={form.html_body} onChange={(e) => setForm((f) => ({ ...f, html_body: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Footer HTML</Label>
                    <textarea className="flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono" value={form.footer_html} onChange={(e) => setForm((f) => ({ ...f, footer_html: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="No templates" description="Create invoice, PO, label templates." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Canvas</TableHead>
                <TableHead>Ver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.template_code)}</TableCell>
                  <TableCell className="text-sm font-medium">{String(r.name)}</TableCell>
                  <TableCell className="capitalize text-sm">{String(r.category)}</TableCell>
                  <TableCell className="text-xs">{String(r.document_type)}</TableCell>
                  <TableCell className="text-xs">{String(r.canvas_size)}</TableCell>
                  <TableCell>v{String(r.version)}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => showPreview(String(r.id))}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Template preview</DialogTitle></DialogHeader>
          {preview && (
            <iframe title="preview" className="w-full h-[60vh] border rounded bg-white" srcDoc={preview} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
