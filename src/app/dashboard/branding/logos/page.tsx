"use client";

import { useEffect, useState } from "react";
import { Image, Plus } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/crud-compat";
import { toast } from "sonner";
import { crudCreate, crudDelete } from "@/lib/api/crud-client";
import { LOGO_TYPES } from "@/lib/branding";

const FORMATS = ["png", "svg", "pdf", "ai", "eps"];

export default function BrandLogosPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    logo_type: "primary",
    file_url: "",
    file_format: "svg",
    min_size_mm: "20",
    clear_space_note: "",
    is_default: false,
  });


  const load = async () => {
    const { data } = await createClient()
      .from("brand_logos")
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
    const res = await crudCreate("brand_logos", {
      name: form.name,
      logo_type: form.logo_type,
      file_url: form.file_url || null,
      file_format: form.file_format,
      min_size_mm: form.min_size_mm ? Number(form.min_size_mm) : null,
      clear_space_note: form.clear_space_note || null,
      is_default: form.is_default,
      status: "active",
      version: 1,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Logo registered");
    setOpen(false);
    await load();
  };

  const softDelete = async (id: string) => {
    const res = await crudDelete("brand_logos", id);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Logo archived");
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading logos…" />;

  return (
    <div>
      <PageHeader
        title="Logo Management"
        description="Primary · secondary · icon · monogram · watermark · dark · light"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add logo</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Register logo variant</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Type</Label>
                      <Select value={form.logo_type} onValueChange={(v) => setForm((f) => ({ ...f, logo_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LOGO_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Format</Label>
                      <Select value={form.file_format} onValueChange={(v) => setForm((f) => ({ ...f, file_format: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FORMATS.map((f) => (
                            <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>File URL</Label>
                    <Input value={form.file_url} onChange={(e) => setForm((f) => ({ ...f, file_url: e.target.value }))} placeholder="https://…" />
                  </div>
                  <div>
                    <Label>Min size (mm)</Label>
                    <Input value={form.min_size_mm} onChange={(e) => setForm((f) => ({ ...f, min_size_mm: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Clear space note</Label>
                    <Input value={form.clear_space_note} onChange={(e) => setForm((f) => ({ ...f, clear_space_note: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Image} title="No logos" description="Register primary and variant logos for multi-company identity." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-medium">
                    {String(r.name)}
                    {Boolean(r.is_default) && <Badge variant="outline" className="ml-2 text-[10px]">default</Badge>}
                  </TableCell>
                  <TableCell className="capitalize">{String(r.logo_type)}</TableCell>
                  <TableCell className="uppercase text-xs">{String(r.file_format || "—")}</TableCell>
                  <TableCell>v{String(r.version ?? 1)}</TableCell>
                  <TableCell><StatusBadge status={String(r.status || "active")} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => softDelete(String(r.id))}>Archive</Button>
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
