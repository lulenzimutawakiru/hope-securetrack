"use client";

import { useEffect, useState } from "react";
import { FileLock2, Plus, Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { crudCreate } from "@/lib/api/crud-client";
import { nextPrtCode, generateSecureDocumentHtml, enqueuePrint } from "@/lib/print";

export default function SecurePdfPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "Certificate of Authenticity",
    document_type: "security",
    body: "This certifies that the product bearing the QR authentication code is genuine SecureTrack ERP security paper.",
    watermark: "AUTHENTIC · SECURETRACK GROUP",
    anti_copy: true,
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("prt_secure_pdfs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
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
      const pdf_code = await nextPrtCode(companyId, "prt_secure_pdfs", "PDF");
      const gen = generateSecureDocumentHtml({
        title: form.title,
        documentType: form.document_type,
        bodyHtml: `<p>${form.body}</p>`,
        watermark: form.watermark,
        antiCopyBg: form.anti_copy,
        companyName: "SecureTrack ERP",
        fields: {
          Issuer: "SecureTrack ERP",
          Document: form.title,
          Code: pdf_code,
        },
      });
      const crudRes = await crudCreate("prt_secure_pdfs", {
          company_id: companyId,
          pdf_code,
          title: form.title,
          document_type: form.document_type,
          html_body: gen.html,
          watermark: form.watermark,
          anti_copy_bg: form.anti_copy,
          microtext: "HOPE-SECURE-TRACK-MICRO-ANTI-COPY",
          signature_hash: gen.signatureHash,
          verification_code: gen.verificationCode,
          pages: 1,
          created_by: auth?.user?.id,
        });
      if (!crudRes.ok) throw new Error(crudRes.error);
      const data = crudRes.data as Record<string, unknown>;

      await enqueuePrint({
        company_id: companyId,
        job_title: `Secure PDF · ${form.title}`,
        document_type: "security",
        secure_release: true,
        copies: 1,
        pages: 1,
        payload_json: {
          pdf_code,
          verification_code: gen.verificationCode,
          signature_hash: gen.signatureHash,
        },
        submitted_by: auth?.user?.id,
      });

      toast.success("Secure document generated");
      setPreview(gen.html);
      setOpen(false);
      setRows((prev) => [data as Record<string, unknown>, ...prev]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading secure documents…" />;

  return (
    <div>
      <PageHeader
        title="Secure PDF & Anti-Copy"
        description="Watermarks · VOID IF COPIED · microtext · SIG hash · security paper products"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Generate secure doc</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Secure document</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Title</Label>
                    <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Body</Label>
                    <Textarea rows={4} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Watermark</Label>
                    <Input value={form.watermark} onChange={(e) => setForm((f) => ({ ...f, watermark: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.anti_copy} onChange={(e) => setForm((f) => ({ ...f, anti_copy: e.target.checked }))} />
                    Anti-copy background
                  </label>
                </div>
                <DialogFooter><Button type="submit">Generate</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={FileLock2} title="No secure PDFs" description="Generate certificates for security paper products." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Verify</TableHead>
                <TableHead>SIG</TableHead>
                <TableHead>Anti-copy</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.pdf_code)}</TableCell>
                  <TableCell className="font-medium text-sm">{String(r.title)}</TableCell>
                  <TableCell className="font-mono text-[10px]">{String(r.verification_code)}</TableCell>
                  <TableCell className="font-mono text-[10px]">{String(r.signature_hash).slice(0, 8)}…</TableCell>
                  <TableCell>
                    {Boolean(r.anti_copy_bg) ? <Badge className="text-[10px]">Yes</Badge> : "—"}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setPreview(String(r.html_body || ""))}>
                      <Eye className="h-3 w-3 mr-1" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Secure document preview</DialogTitle></DialogHeader>
          {preview && <iframe title="Secure PDF" srcDoc={preview} className="w-full h-[70vh] rounded border bg-white" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
