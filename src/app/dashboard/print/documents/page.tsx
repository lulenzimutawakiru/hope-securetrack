"use client";

import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { enqueuePrint } from "@/lib/print";

const DOC_TYPES = [
  "invoice", "po", "quotation", "delivery_note", "grn", "receipt",
  "report", "contract", "work_order", "certificate",
];

export default function PrintDocumentsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [printers, setPrinters] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    profile_code: "",
    name: "",
    document_type: "invoice",
    paper_size: "A4",
    copies: "1",
    default_printer_id: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data }, { data: pr }] = await Promise.all([
      sb.from("prt_document_profiles").select("*, printers(name)").order("profile_code"),
      sb.from("printers").select("id,name").eq("is_active", true),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setPrinters((pr as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const crudRes = await crudCreate("prt_document_profiles", {
        company_id: companyId,
        profile_code: form.profile_code.toUpperCase(),
        name: form.name,
        document_type: form.document_type,
        paper_size: form.paper_size,
        copies: Number(form.copies) || 1,
        default_printer_id: form.default_printer_id || null,
        is_active: true,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Document profile created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const printSample = async (r: Record<string, unknown>) => {
    if (!companyId) return;
    try {
      await enqueuePrint({
        company_id: companyId,
        job_title: `Sample ${String(r.name)}`,
        document_type: String(r.document_type),
        printer_id: r.default_printer_id as string | null,
        copies: Number(r.copies) || 1,
        payload_json: { sample: true, document_type: r.document_type },
        submitted_by: auth?.user?.id,
      });
      toast.success("Sample document queued");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading document profiles…" />;

  return (
    <div>
      <PageHeader
        title="Document Print Profiles"
        description="Invoice · PO · GRN · delivery · receipt · certificate routing"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New profile</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Document print profile</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.profile_code} onChange={(e) => setForm((f) => ({ ...f, profile_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Paper</Label>
                      <Input value={form.paper_size} onChange={(e) => setForm((f) => ({ ...f, paper_size: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Document type</Label>
                    <Select value={form.document_type} onValueChange={(v) => setForm((f) => ({ ...f, document_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOC_TYPES.map((d) => (
                          <SelectItem key={d} value={d} className="capitalize">{d.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Default printer</Label>
                    <Select value={form.default_printer_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, default_printer_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {printers.map((p) => (
                          <SelectItem key={String(p.id)} value={String(p.id)}>{String(p.name)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="No document profiles" description="Map ERP documents to printers and paper." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Paper</TableHead>
                <TableHead>Printer</TableHead>
                <TableHead>Copies</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const pr = r.printers as { name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">{String(r.profile_code)}</TableCell>
                    <TableCell className="font-medium text-sm">{String(r.name)}</TableCell>
                    <TableCell className="capitalize text-sm">{String(r.document_type).replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm">{String(r.paper_size)}</TableCell>
                    <TableCell className="text-sm">{pr?.name || "—"}</TableCell>
                    <TableCell>{String(r.copies)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => printSample(r)}>Queue sample</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
