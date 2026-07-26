"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QrCode, Sparkles, Tag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import type { QrCode as QrCodeType, ProductionBatch } from "@/types/database";

export default function QrCodesPage() {
  const { hasPermission } = useUser();
  const [codes, setCodes] = useState<QrCodeType[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    batchId: "",
    quantity: "50",
    codeType: "ream",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: batchData }] = await Promise.all([
      supabase
        .from("qr_codes")
        .select("*, products(name), production_batches(batch_number)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("production_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setCodes((data as QrCodeType[]) ?? []);
    setBatches((batchData as ProductionBatch[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-qr`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          },
          body: JSON.stringify({
            batchId: form.batchId,
            quantity: parseInt(form.quantity, 10),
            codeType: form.codeType,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        const detail =
          Array.isArray(data.details) && data.details.length
            ? `: ${data.details[0]}`
            : data.details
              ? `: ${data.details}`
              : "";
        throw new Error((data.error || "Generation failed") + detail);
      }

      toast.success(`Generated ${data.generated} QR codes`);
      setOpen(false);
      setForm({ batchId: "", quantity: "50", codeType: "ream" });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate QR codes");
    } finally {
      setGenerating(false);
    }
  };

  const filtered = codes.filter(
    (c) =>
      !search ||
      c.human_serial.toLowerCase().includes(search.toLowerCase()) ||
      c.public_uuid.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="QR Codes"
        description="Generate and manage secure product authentication codes"
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/labels">
              <Button variant="outline">
                <Tag className="mr-2 h-4 w-4" />
                Print Labels
              </Button>
            </Link>
          {hasPermission("qr.generate") && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate QR Codes
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleGenerate}>
                  <DialogHeader>
                    <DialogTitle>Generate QR Codes</DialogTitle>
                    <DialogDescription>
                      Create encrypted, signed QR codes for a production batch
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Production Batch</Label>
                      <Select
                        value={form.batchId}
                        onValueChange={(v) => setForm({ ...form, batchId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select batch" />
                        </SelectTrigger>
                        <SelectContent>
                          {batches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.batch_number} — {b.product_code} ({b.quantity_reams} reams)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5000}
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code Type</Label>
                      <Select
                        value={form.codeType}
                        onValueChange={(v) => setForm({ ...form, codeType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ream">Ream</SelectItem>
                          <SelectItem value="carton">Carton</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={generating || !form.batchId}>
                      {generating ? "Generating..." : "Generate"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
          </div>
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Search by serial or UUID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title="No QR codes"
          description="Generate QR codes for a production batch to get started"
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prints</TableHead>
                <TableHead>Verifications</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.human_serial}</TableCell>
                  <TableCell className="capitalize">{c.code_type}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {c.production_batches?.batch_number ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{c.products?.name ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell>{formatNumber(c.print_count)}</TableCell>
                  <TableCell>{formatNumber(c.verification_count)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(c.created_at)}
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
