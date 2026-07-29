"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FolderOpen, AlertTriangle } from "lucide-react";
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
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import { listDocuments, createDocument, listSuppliers } from "@/lib/srm";
import { toast } from "sonner";

export default function SrmDocumentsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    supplier_id: "",
    doc_type: "certificate",
    title: "",
    file_name: "",
    expires_at: "",
  });

  const load = async () => {
    try {
      const [d, s] = await Promise.all([listDocuments(), listSuppliers({ limit: 80 })]);
      setRows(d);
      setSuppliers(s);
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
    if (!auth || !form.supplier_id) return;
    try {
      await createDocument({
        company_id: auth.profile.company_id,
        supplier_id: form.supplier_id,
        doc_type: form.doc_type,
        title: form.title,
        file_name: form.file_name,
        expires_at: form.expires_at || undefined,
        uploaded_by: auth.user.id,
      });
      toast.success("Document registered");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading documents…" />;

  const expiring = rows.filter((r) => {
    if (!r.expires_at) return false;
    const days = (new Date(String(r.expires_at)).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 60;
  });

  return (
    <div>
      <PageHeader
        title="Supplier Document Management"
        description="Contracts · certificates · insurance · price lists · expiry reminders · version control"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement/contracts">Contracts</Link>
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
                      <Label>Supplier</Label>
                      <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={String(s.id)} value={String(s.id)}>{String(s.name)}</SelectItem>
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
                            {["contract", "nda", "certificate", "insurance", "price_list", "catalog", "bank_letter", "tax_clearance", "audit", "other"].map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Expires</Label>
                        <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div>
                      <Label>File name</Label>
                      <Input value={form.file_name} onChange={(e) => setForm({ ...form, file_name: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Documents" value={String(rows.length)} icon={FolderOpen} />
        <StatCard title="Expiring ≤60 days" value={String(expiring.length)} icon={AlertTriangle} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No documents" description="Upload certificates and contracts with expiry tracking." />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const days = r.expires_at
                  ? Math.ceil((new Date(String(r.expires_at)).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;
                const soon = days != null && days <= 60;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-medium text-sm">{String(r.title)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] capitalize">{String(r.doc_type)}</Badge></TableCell>
                    <TableCell>v{String(r.version || 1)}</TableCell>
                    <TableCell className={`text-xs ${soon ? "text-destructive font-medium" : ""}`}>
                      {r.expires_at ? String(r.expires_at).slice(0, 10) : "—"}
                      {soon && days != null ? ` (${days}d)` : ""}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{String(r.status || "valid")}</Badge></TableCell>
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
