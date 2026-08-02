"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { crudCreate } from "@/lib/api/crud-client";
import { listCustomers } from "@/lib/crm";
import { toast } from "sonner";

export default function CrmDocumentsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    doc_type: "contract",
    title: "",
    file_name: "",
    file_url: "",
    notes: "",
  });

  const load = async () => {
    try {
      const supabase = createClient();
      const [{ data }, cust] = await Promise.all([
        supabase
          .from("crm_documents")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(100),
        listCustomers({ limit: 80 }),
      ]);
      setRows(data || []);
      setCustomers(cust);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !form.customer_id) return;
    try {
      const res = await crudCreate("crm_documents", {
        customer_id: form.customer_id,
        doc_type: form.doc_type,
        title: form.title,
        file_name: form.file_name || form.title,
        file_url: form.file_url || null,
        notes: form.notes || null,
        version: 1,
        is_latest: true,
        uploaded_by: auth.user.id,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Document registered");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading documents…" />;

  return (
    <div>
      <PageHeader
        title="CRM Document Management"
        description="Contracts · POs · tax certificates · delivery notes · version control"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/crm/contracts">Contracts</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add document</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Register document</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Customer</Label>
                      <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={String(c.id)} value={String(c.id)}>{String(c.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Type</Label>
                        <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["contract", "po", "quotation", "tax_certificate", "delivery_note", "invoice", "nda", "other"].map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>File name</Label>
                        <Input value={form.file_name} onChange={(e) => setForm({ ...form, file_name: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div>
                      <Label>URL / storage path</Label>
                      <Input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} placeholder="https://..." />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="No documents" description="Register customer documents with version history." />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-medium text-sm">{String(r.title)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] capitalize">{String(r.doc_type)}</Badge></TableCell>
                  <TableCell>v{String(r.version || 1)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                    {String(r.file_name || r.file_url || "—")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.created_at ? new Date(String(r.created_at)).toLocaleDateString() : "—"}
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
