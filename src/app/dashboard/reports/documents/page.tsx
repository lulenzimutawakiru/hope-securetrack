"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileStack, Plus, Printer } from "lucide-react";
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
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { printDocumentBranded } from "@/lib/documents-brand";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

const DOC_TYPES = [
  "invoice",
  "receipt",
  "po",
  "dn",
  "grn",
  "payslip",
  "contract",
  "certificate",
  "letter",
  "report",
  "tax_return",
];

export default function DocumentGeneratorPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    document_type: "report",
    title: "",
    reference_number: "",
    template_key: "standard",
    format: "pdf",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("bi_document_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const crudRes = await crudCreate("bi_document_jobs", {
      company_id: auth.profile.company_id,
      document_type: form.document_type,
      title: form.title,
      reference_number: form.reference_number || null,
      template_key: form.template_key,
      format: form.format,
      status: "ready",
      generated_by: auth.profile.id,
      completed_at: new Date().toISOString(),
      payload: { generated_via: "document_generator" },
    });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Document job created");
      setOpen(false);
      load();
    }
  };

  const preview = async (r: Record<string, unknown>) => {
    try {
      await printDocumentBranded({
        title: String(r.title),
        docType: String(r.document_type).toUpperCase(),
        number: String(r.reference_number ?? r.id).slice(0, 36),
        date: r.created_at
          ? new Date(String(r.created_at)).toLocaleDateString()
          : undefined,
        status: String(r.status ?? ""),
        meta: [
          { label: "Template", value: String(r.template_key ?? "—") },
          { label: "Format", value: String(r.format ?? "pdf") },
          { label: "Status", value: String(r.status) },
        ],
        lines: [
          {
            description: `Enterprise ${String(r.document_type)} — SecureTrack ERP Document Intelligence`,
            quantity: 1,
            unit: "doc",
            unit_price: 0,
            amount: 0,
          },
          {
            description: `Payload: ${JSON.stringify(r.payload ?? {})}`,
            quantity: 1,
            unit: "meta",
            unit_price: 0,
            amount: 0,
          },
        ],
        notes: "Computer-generated document pack for SecureTrack ERP.",
        footerNote: "Security Printing · Paper Manufacturing · Engineering",
      }, auth?.profile?.company_id);
      toast.success("Print dialog opened");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print failed");
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Enterprise Document Generator"
        description="Invoices · PO · GRN · payslips · contracts · certificates · tax packs · letters"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Generate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>Generate document</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.document_type}
                      onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))}
                    >
                      {DOC_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Reference</Label>
                      <Input
                        value={form.reference_number}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, reference_number: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Template key</Label>
                      <Input
                        value={form.template_key}
                        onChange={(e) => setForm((f) => ({ ...f, template_key: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Queue / generate</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={FileStack} title="No document jobs" description="Generate enterprise documents" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="uppercase text-xs font-mono">
                    {String(r.document_type)}
                  </TableCell>
                  <TableCell className="text-sm">{String(r.title)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {String(r.reference_number ?? "—")}
                  </TableCell>
                  <TableCell className="text-xs">{String(r.template_key ?? "—")}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        r.status === "ready"
                          ? "bg-green-100 text-green-800"
                          : undefined
                      }
                      variant={r.status === "ready" ? "default" : "secondary"}
                    >
                      {String(r.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {r.created_at
                      ? new Date(String(r.created_at)).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => preview(r)}>
                      <Printer className="h-3.5 w-3.5 mr-1" />
                      Print
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
