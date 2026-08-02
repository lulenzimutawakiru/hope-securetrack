"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Hash, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

const DOC_TYPES = [
  "po", "invoice", "grn", "quote", "so", "pr", "journal", "employee", "asset", "batch", "dn", "credit_note",
];

function preview(prefix: string, includeYear: boolean, includeBranch: boolean, pad: number, next: number, suffix: string) {
  let s = prefix || "";
  if (includeYear) s += new Date().getFullYear() + "-";
  if (includeBranch) s += "BR-HQ-";
  s += String(next).padStart(pad || 6, "0");
  if (suffix) s += suffix;
  return s;
}

export default function NumberingSettingsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    document_type: "po",
    prefix: "HDG-PO-",
    suffix: "",
    include_year: true,
    include_branch: false,
    pad_length: "6",
    next_number: "1",
    reset_rule: "yearly",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("document_sequences")
      .select("*")
      .order("document_type");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditId(null);
    setForm({
      document_type: "po",
      prefix: "HDG-",
      suffix: "",
      include_year: true,
      include_branch: false,
      pad_length: "6",
      next_number: "1",
      reset_rule: "yearly",
    });
    setOpen(true);
  };

  const openEdit = (r: Record<string, unknown>) => {
    setEditId(String(r.id));
    setForm({
      document_type: String(r.document_type),
      prefix: String(r.prefix ?? ""),
      suffix: String(r.suffix ?? ""),
      include_year: Boolean(r.include_year),
      include_branch: Boolean(r.include_branch),
      pad_length: String(r.pad_length ?? 6),
      next_number: String(r.next_number ?? 1),
      reset_rule: String(r.reset_rule ?? "yearly"),
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const sample = preview(
      form.prefix,
      form.include_year,
      form.include_branch,
      Number(form.pad_length),
      Number(form.next_number),
      form.suffix
    );
    const payload = {
      document_type: form.document_type,
      prefix: form.prefix,
      suffix: form.suffix || "",
      include_year: form.include_year,
      include_branch: form.include_branch,
      pad_length: Number(form.pad_length) || 6,
      next_number: Number(form.next_number) || 1,
      reset_rule: form.reset_rule,
      sample_format: sample,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (editId) {
      const crudRes2 = await crudUpdate("document_sequences", editId, payload);
      if (!crudRes2.ok) {
        toast.error(crudRes2.error);
        return;
      }
    } else {
      const crudRes2 = await crudCreate("document_sequences", payload);
      if (!crudRes2.ok) {
        toast.error(crudRes2.error);
        return;
      }
    }
    await supabase.from("config_change_log").insert({
      company_id: auth.profile.company_id,
      entity_type: "document_sequence",
      entity_id: editId,
      action: editId ? "update" : "create",
      field_name: form.document_type,
      new_value: sample,
      changed_by: auth.profile.id,
    });
    toast.success(editId ? "Sequence updated" : "Sequence created");
    setOpen(false);
    load();
  };

  const toggle = async (id: string, is_active: boolean) => {
    const supabase = createClient();
    const crudRes = await crudUpdate("document_sequences", id, { is_active: !is_active });
    if (!crudRes.ok) toast.error(crudRes.error);
    else load();
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Document Numbering"
        description="Configure formats: HDG-PO-{YYYY}-{000001} · fiscal/branch resets"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  Sequence
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={save} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>{editId ? "Edit sequence" : "New sequence"}</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Document type</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.document_type}
                        onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))}
                        disabled={!!editId}
                      >
                        {DOC_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Reset rule</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.reset_rule}
                        onChange={(e) => setForm((f) => ({ ...f, reset_rule: e.target.value }))}
                      >
                        <option value="never">Never</option>
                        <option value="yearly">Yearly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Prefix</Label>
                      <Input
                        value={form.prefix}
                        onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Suffix</Label>
                      <Input
                        value={form.suffix}
                        onChange={(e) => setForm((f) => ({ ...f, suffix: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Pad length</Label>
                      <Input
                        type="number"
                        value={form.pad_length}
                        onChange={(e) => setForm((f) => ({ ...f, pad_length: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Next number</Label>
                      <Input
                        type="number"
                        value={form.next_number}
                        onChange={(e) => setForm((f) => ({ ...f, next_number: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.include_year}
                        onChange={(e) => setForm((f) => ({ ...f, include_year: e.target.checked }))}
                      />
                      Include year
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.include_branch}
                        onChange={(e) => setForm((f) => ({ ...f, include_branch: e.target.checked }))}
                      />
                      Include branch
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
                    Preview:{" "}
                    {preview(
                      form.prefix,
                      form.include_year,
                      form.include_branch,
                      Number(form.pad_length),
                      Number(form.next_number),
                      form.suffix
                    )}
                  </p>
                  <DialogFooter>
                    <Button type="submit">{editId ? "Update" : "Create"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Hash} title="No sequences" description="Define document number formats" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Sample</TableHead>
                <TableHead>Next</TableHead>
                <TableHead>Reset</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono uppercase text-sm">{String(r.document_type)}</TableCell>
                  <TableCell className="font-mono text-sm">{String(r.prefix ?? "")}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {String(r.sample_format ?? "—")}
                  </TableCell>
                  <TableCell>{String(r.next_number)}</TableCell>
                  <TableCell className="text-sm">{String(r.reset_rule ?? "yearly")}</TableCell>
                  <TableCell>
                    {r.is_active ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Off</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggle(String(r.id), Boolean(r.is_active))}
                    >
                      {r.is_active ? "Disable" : "Enable"}
                    </Button>
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
