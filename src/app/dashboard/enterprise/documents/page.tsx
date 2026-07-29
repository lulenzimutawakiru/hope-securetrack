"use client";

import { useEffect, useState } from "react";
import { Plus, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { listDocuments, createDocument, DOC_TYPES } from "@/lib/enterprise-company";
import { FileUpload } from "@/components/ui/file-upload";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function CompanyDocumentsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [open, setOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [form, setForm] = useState({
    doc_type: "license", title: "", doc_number: "", expiry_date: "",
  });

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    try {
      setRows((await listDocuments(auth.profile.company_id)) as Array<Record<string, unknown>>);
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [auth]);

  const save = async () => {
    if (!auth || !form.title) return toast.error("Title required");
    try {
      await createDocument({
        company_id: auth.profile.company_id,
        doc_type: form.doc_type,
        title: form.title,
        doc_number: form.doc_number || undefined,
        expiry_date: form.expiry_date || undefined,
        file_url: fileUrl || undefined,
        uploaded_by: auth.user.id,
      });
      toast.success("Document registered");
      setOpen(false);
      setFileUrl("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading document vault…" />;

  const soon = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Company Document Vault"
        description="Incorporation · tax · licenses · ISO · policies · expiry reminders"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add</Button>}
      />
      {rows.length === 0 ? (
        <EmptyState title="No documents" description="Register compliance and legal documents." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const exp = r.expiry_date ? String(r.expiry_date) : "";
                const expiring = exp && exp <= soon;
                return (
                  <TableRow key={r.id as string}>
                    <TableCell><Badge variant="outline">{String(r.doc_type)}</Badge></TableCell>
                    <TableCell className="text-sm font-medium flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />{String(r.title)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{String(r.doc_number || "—")}</TableCell>
                    <TableCell className={`text-xs ${expiring ? "text-amber-600 font-medium" : ""}`}>
                      {exp ? formatDate(exp) : "—"}
                      {expiring ? " · renew" : ""}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{String(r.status)}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Register document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Number</Label><Input value={form.doc_number} onChange={(e) => setForm({ ...form, doc_number: e.target.value })} /></div>
            <div><Label>Expiry</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
            <FileUpload
              bucket="documents"
              category="document"
              folder="company-docs"
              entityTable="ec_company_documents"
              value={fileUrl}
              label="Upload file (PDF, image, Office)"
              onUploaded={(r) => setFileUrl(r.publicUrl)}
              onCleared={() => setFileUrl("")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
