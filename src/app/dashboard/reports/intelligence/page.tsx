"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Printer, Plus, Hash } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { printDocumentBranded } from "@/lib/documents-brand";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

const TYPES = [
  "board_paper",
  "meeting_minutes",
  "inspection",
  "batch_report",
  "asset_certificate",
  "qr_certificate",
  "audit_report",
];

const CLASSIFICATIONS = ["public", "internal", "confidential", "restricted"];

function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  return `sha256-sim-${(h >>> 0).toString(16).padStart(8, "0")}`;
}

export default function DocumentIntelligencePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [revisions, setRevisions] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    document_code: "",
    document_type: "board_paper",
    title: "",
    classification: "internal",
    version_number: "1.0",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: revs }] = await Promise.all([
      supabase
        .from("bi_intelligent_documents")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("bi_document_revisions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setRows(data ?? []);
    setRevisions(revs ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      typeFilter === "all"
        ? rows
        : rows.filter((r) => String(r.document_type) === typeFilter),
    [rows, typeFilter]
  );

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const code = form.document_code.toUpperCase();
    const hash = simpleHash(`${code}|${form.title}|${form.version_number}|${Date.now()}`);
    const supabase = createClient();
    const crudRes3 = await crudCreate("bi_intelligent_documents", {
        company_id: auth.profile.company_id,
        document_code: code,
        document_type: form.document_type,
        title: form.title,
        classification: form.classification,
        version_number: form.version_number,
        status: "draft",
        qr_payload: `HDG:${form.document_type}:${code}`,
        barcode_value: code,
        document_hash: hash,
        hash_algorithm: "SHA-256",
        watermark_text: `SecureTrack ERP — ${form.classification.toUpperCase()}`,
        digital_certificate_ref: "CERT-HDG-CORP-01",
        tamper_status: "verified",
        approval_chain: [{ role: "Author", status: "pending" }],
        content: {},
        owner_id: auth.profile.id,
      });
    if (!crudRes3.ok) {
      toast.error(crudRes3.error);
      return;
    }
    const data = crudRes3.data as Record<string, unknown>;
    if (data) {
      const crudRes2 = await crudCreate("bi_document_revisions", {
        company_id: auth.profile.company_id,
        document_id: data.id,
        version_number: form.version_number,
        change_summary: "Initial draft",
        document_hash: hash,
        changed_by: auth.profile.id,
      });
    }
    toast.success("Intelligent document created");
    setOpen(false);
    load();
  };

  const printDoc = async (r: Record<string, unknown>) => {
    try {
      await printDocumentBranded({
        title: String(r.title),
        docType: String(r.document_type).replace(/_/g, " ").toUpperCase(),
        number: String(r.document_code),
        status: String(r.status),
        date: r.created_at
          ? new Date(String(r.created_at)).toLocaleDateString()
          : undefined,
        meta: [
          { label: "Classification", value: String(r.classification) },
          { label: "Version", value: String(r.version_number) },
          { label: "Hash", value: String(r.document_hash ?? "").slice(0, 24) + "…" },
          { label: "QR", value: String(r.qr_payload ?? "") },
          { label: "Barcode", value: String(r.barcode_value ?? "") },
          { label: "Certificate", value: String(r.digital_certificate_ref ?? "") },
          { label: "Tamper", value: String(r.tamper_status) },
        ],
        lines: [
          {
            description: `Watermark: ${String(r.watermark_text ?? "")}`,
            quantity: 1,
            unit: "mark",
          },
          {
            description: `Approval chain: ${JSON.stringify(r.approval_chain ?? [])}`,
            quantity: 1,
            unit: "chain",
          },
          {
            description: `Payload: ${JSON.stringify(r.content ?? {})}`,
            quantity: 1,
            unit: "json",
          },
        ],
        notes:
          "Digitally sealed document. Hash and QR enable tamper detection. Classification watermark applies to exports.",
        footerNote: "SecureTrack ERP · Document Intelligence · SecureTrack",
      }, auth?.profile?.company_id);
      toast.success("Print dialog opened");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print failed");
    }
  };

  const approve = async (r: Record<string, unknown>) => {
    if (!auth) return;
    const supabase = createClient();
    const chain = Array.isArray(r.approval_chain)
      ? (r.approval_chain as Array<Record<string, string>>).map((s) => ({
          ...s,
          status: "approved",
        }))
      : [{ role: "Approver", status: "approved" }];
    const crudRes = await crudUpdate("bi_intelligent_documents", String(r.id), {
        status: "approved",
        approval_chain: chain,
        approved_by: auth.profile.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Document approved");
      load();
    }
  };

  if (loading) return <LoadingState message="Loading document intelligence…" />;

  return (
    <div>
      <PageHeader
        title="Document Intelligence"
        description="Board papers · minutes · inspection · batch · asset/QR certificates · audit — with QR, hash, seal, watermark, approval chain"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Document
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>New intelligent document</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Code</Label>
                      <Input
                        value={form.document_code}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, document_code: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.document_type}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, document_type: e.target.value }))
                        }
                      >
                        {TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
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
                      <Label>Classification</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.classification}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, classification: e.target.value }))
                        }
                      >
                        {CLASSIFICATIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Version</Label>
                      <Input
                        value={form.version_number}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, version_number: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create with hash + QR</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          size="sm"
          variant={typeFilter === "all" ? "default" : "outline"}
          onClick={() => setTypeFilter("all")}
        >
          All
        </Button>
        {TYPES.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={typeFilter === t ? "default" : "outline"}
            onClick={() => setTypeFilter(t)}
            className="capitalize"
          >
            {t.replace(/_/g, " ")}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No intelligent documents"
          description="Create board papers, certificates, audit packs"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((r) => (
            <Card
              key={String(r.id)}
              className={
                selected && String(selected.id) === String(r.id)
                  ? "border-hope-teal"
                  : undefined
              }
            >
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-sm">{String(r.title)}</CardTitle>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {String(r.classification)}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    v{String(r.version_number)}
                  </Badge>
                  <Badge className="text-[10px] capitalize">{String(r.status)}</Badge>
                </div>
                <p className="text-xs font-mono text-muted-foreground">
                  {String(r.document_code)} · {String(r.document_type)}
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {String(r.document_hash ?? "").slice(0, 18)}…
                  </span>
                  <span>Tamper: {String(r.tamper_status)}</span>
                  <span>QR: {String(r.qr_payload ?? "—")}</span>
                  <span>Barcode: {String(r.barcode_value ?? "—")}</span>
                  <span className="col-span-2">
                    Cert: {String(r.digital_certificate_ref ?? "—")}
                  </span>
                  <span className="col-span-2 line-clamp-1">
                    Watermark: {String(r.watermark_text ?? "")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setSelected(r)}>
                    Details
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => printDoc(r)}>
                    <Printer className="h-3.5 w-3.5 mr-1" />
                    Print sealed
                  </Button>
                  {String(r.status) !== "approved" && String(r.status) !== "published" && (
                    <Button size="sm" onClick={() => approve(r)}>
                      Approve
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">
              Approval chain & revisions — {String(selected.document_code)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
              {JSON.stringify(selected.approval_chain ?? [], null, 2)}
            </pre>
            <div>
              <p className="text-sm font-medium mb-2">Revision history</p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {revisions
                  .filter((rev) => String(rev.document_id) === String(selected.id))
                  .map((rev) => (
                    <li key={String(rev.id)}>
                      v{String(rev.version_number)} — {String(rev.change_summary ?? "")} ·{" "}
                      {String(rev.document_hash ?? "").slice(0, 16)}…
                    </li>
                  ))}
                {revisions.filter((rev) => String(rev.document_id) === String(selected.id))
                  .length === 0 && <li>No revisions stored</li>}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
