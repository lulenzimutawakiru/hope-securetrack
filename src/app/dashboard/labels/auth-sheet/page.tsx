"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import {
  Printer,
  Tag,
  Download,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { LabelCard } from "@/components/labels/label-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import type { LabelData } from "@/lib/labels";
import { buildLabelQrValue } from "@/lib/verification";
import type { ProductionBatch, QrCode } from "@/types/database";

export default function LabelsPage() {
  const { auth } = useUser();
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [codeType, setCodeType] = useState<"ream" | "carton">("ream");
  const [statusFilter, setStatusFilter] = useState("generated");
  const [codes, setCodes] = useState<QrCode[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [labels, setLabels] = useState<LabelData[]>([]);
  const [building, setBuilding] = useState(false);
  const [marking, setMarking] = useState(false);
  const [queuing, setQueuing] = useState(false);
  const [search, setSearch] = useState("");
  const [printers, setPrinters] = useState<
    { id: string; name: string; model: string; status: string }[]
  >([]);
  const [printerId, setPrinterId] = useState<string>("");

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hope-securetrack.vercel.app";

  useEffect(() => {
    async function loadBatches() {
      const supabase = createClient();
      const [{ data }, { data: pr }] = await Promise.all([
        supabase
          .from("production_batches")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("printers")
          .select("id,name,model,status")
          .eq("is_active", true)
          .order("is_default", { ascending: false }),
      ]);
      setBatches((data as ProductionBatch[]) ?? []);
      setPrinters(pr ?? []);
      if (pr?.[0]?.id) setPrinterId(pr[0].id);
      setLoading(false);
    }
    loadBatches();
  }, []);

  useEffect(() => {
    if (!batchId) {
      setCodes([]);
      setSelected(new Set());
      return;
    }
    async function loadCodes() {
      const supabase = createClient();
      let q = supabase
        .from("qr_codes")
        .select("*, products(name, product_code, paper_size, gsm), production_batches(batch_number, manufacturing_date)")
        .eq("batch_id", batchId)
        .eq("code_type", codeType)
        .order("created_at", { ascending: true })
        .limit(500);

      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }

      const { data, error } = await q;
      if (error) {
        toast.error(error.message);
        return;
      }
      setCodes((data as QrCode[]) ?? []);
      setSelected(new Set());
      setLabels([]);
    }
    loadCodes();
  }, [batchId, codeType, statusFilter]);

  const filtered = useMemo(() => {
    if (!search) return codes;
    const s = search.toLowerCase();
    return codes.filter(
      (c) =>
        c.human_serial.toLowerCase().includes(s) ||
        c.public_uuid.toLowerCase().includes(s)
    );
  }, [codes, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const buildLabels = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one QR code");
      return;
    }
    setBuilding(true);
    try {
      const chosen = codes.filter((c) => selected.has(c.id));
      const built: LabelData[] = chosen.map((c) => {
        // Short URL QR — phones scan reliably; portal resolves UUID server-side
        const qrData = buildLabelQrValue(c.public_uuid, appUrl);

        return {
          id: c.id,
          serial: c.human_serial,
          publicUuid: c.public_uuid,
          qrData,
          productName: c.products?.name,
          productCode: c.products?.product_code,
          paperSize: c.products?.paper_size ?? null,
          gsm: c.products?.gsm ?? null,
          batchNumber: c.production_batches?.batch_number,
          codeType: c.code_type,
          manufacturingDate: c.production_batches?.manufacturing_date,
          companyName: "SecureTrack ERP",
        };
      });
      setLabels(built);
      toast.success(`Prepared ${built.length} labels`);
    } finally {
      setBuilding(false);
    }
  };

  const handlePrint = () => {
    if (labels.length === 0) {
      toast.error("Build labels first");
      return;
    }
    window.print();
  };

  const queueNiimbot = async () => {
    if (!batchId || selected.size === 0) {
      toast.error("Select a batch and QR codes");
      return;
    }
    setQueuing(true);
    try {
      const res = await fetch("/api/print/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId,
          printerId: printerId || null,
          labelType: codeType,
          qrCodeIds: Array.from(selected),
          copies: 1,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        throw new Error(json?.error?.message || "Queue failed");
      }
      toast.success(
        `Queued ${json.data?.totalLabels ?? selected.size} labels for Niimbot agent`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Queue failed");
    } finally {
      setQueuing(false);
    }
  };

  const markPrinted = async () => {
    if (!auth || labels.length === 0) return;
    setMarking(true);
    try {
      const ids = labels.map((l) => l.id);
      const stamp = {
        status: "printed",
        print_count: 1,
        last_printed_at: new Date().toISOString(),
        last_printed_by: auth.profile.id,
      };
      for (const id of ids) {
        const res = await crudUpdate("qr_codes", id, stamp);
        if (!res.ok) throw new Error(res.error);
      }

      // Create print job record
      const crudRes = await crudCreate("print_jobs", {
        company_id: auth.profile.company_id,
        batch_id: batchId || null,
        job_type: "label_sheet",
        status: "completed",
        label_type: codeType,
        total_labels: labels.length,
        printed_labels: labels.length,
        is_reprint: statusFilter === "printed",
        created_by: auth.profile.id,
        completed_at: new Date().toISOString(),
        metadata: { source: "browser_label_print", serials: labels.map((l) => l.serial) },
      });

      toast.success("Marked as printed");
      // refresh codes
      setStatusFilter("all");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark printed");
    } finally {
      setMarking(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Label Studio"
        description="Produce printable authentication labels with QR codes for verification"
        actions={
          <div className="flex gap-2 print:hidden">
            <Link href="/dashboard/printers">
              <Button variant="outline" type="button">
                Printers
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={buildLabels}
              disabled={selected.size === 0 || building}
            >
              {building ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Tag className="mr-2 h-4 w-4" />
              )}
              Build Labels ({selected.size})
            </Button>
            <Button
              variant="default"
              onClick={queueNiimbot}
              disabled={selected.size === 0 || queuing || !batchId}
            >
              {queuing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              Queue Niimbot
            </Button>
            <Button onClick={handlePrint} disabled={labels.length === 0} variant="outline">
              <Printer className="mr-2 h-4 w-4" />
              Browser print
            </Button>
            <Button
              variant="secondary"
              onClick={markPrinted}
              disabled={labels.length === 0 || marking}
            >
              {marking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Mark Printed
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 print:hidden mb-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">1. Select source</CardTitle>
            <CardDescription>Batch and codes to label</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Production batch</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.batch_number} · {b.product_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Label type</Label>
              <Select
                value={codeType}
                onValueChange={(v) => setCodeType(v as "ream" | "carton")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ream">Ream (50×30mm)</SelectItem>
                  <SelectItem value="carton">Carton (70×50mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>QR status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generated">Generated (new)</SelectItem>
                  <SelectItem value="printed">Already printed</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Search serial</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="RM-…"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Niimbot / printer target</Label>
              <Select value={printerId} onValueChange={setPrinterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select printer" />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.model}) · {p.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Labels use short verify URLs for reliable phone scans. Queue jobs
              for the Windows print agent, or browser-print A4 sheets.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">2. Choose codes</CardTitle>
              <CardDescription>
                {filtered.length} codes · {selected.size} selected
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={selectAll}>
              {selected.size === filtered.length && filtered.length > 0
                ? "Clear"
                : "Select all"}
            </Button>
          </CardHeader>
          <CardContent>
            {!batchId ? (
              <EmptyState
                icon={Tag}
                title="Select a batch"
                description="Generate QR codes on the QR Codes page first, then produce labels here"
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Tag}
                title="No QR codes"
                description="Generate QR codes for this batch, or change the status filter"
              />
            ) : (
              <div className="max-h-[360px] overflow-y-auto space-y-1 border rounded-lg p-2">
                {filtered.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggle(c.id)}
                    />
                    <span className="font-mono text-sm flex-1">
                      {c.human_serial}
                    </span>
                    <Badge variant="outline" className="capitalize text-xs">
                      {c.status}
                    </Badge>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardHeader className="print:hidden">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" />
            3. Label preview
          </CardTitle>
          <CardDescription>
            {labels.length
              ? `${labels.length} labels ready — use Print (Ctrl+P)`
              : "Build labels to preview the sheet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {labels.length === 0 ? (
            <div className="print:hidden py-12 text-center text-sm text-muted-foreground">
              No labels built yet
            </div>
          ) : (
            <div
              ref={printRef}
              id="label-print-sheet"
              className="flex flex-wrap gap-3 justify-start print:gap-2"
            >
              {labels.map((label) => (
                <LabelCard
                  key={label.id}
                  label={label}
                  appUrl={appUrl}
                  size={codeType}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
