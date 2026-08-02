"use client";

import { useEffect, useState } from "react";
import { Plus, ScanLine } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";
import { startAudit, scanAuditLine, AUDIT_RESULTS } from "@/lib/assets";

export default function AssetAuditsPage() {
  const { auth } = useUser();
  const [audits, setAudits] = useState<Array<Record<string, unknown>>>([]);
  const [lines, setLines] = useState<Array<Record<string, unknown>>>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Physical inventory");
  const [method, setMethod] = useState("qr");
  const [scanVal, setScanVal] = useState("");
  const [result, setResult] = useState("found");

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("ast_audits")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setAudits((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  const loadLines = async (auditId: string) => {
    const { data } = await createClient()
      .from("ast_audit_lines")
      .select("*")
      .eq("audit_id", auditId)
      .order("scanned_at", { ascending: false })
      .limit(100);
    setLines((data as Array<Record<string, unknown>>) || []);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeId) loadLines(activeId).catch(() => {});
  }, [activeId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const a = await startAudit({
        company_id: companyId,
        name,
        method,
        created_by: userId,
      });
      toast.success(`Audit ${a.audit_number} started`);
      setOpen(false);
      setActiveId(a.id);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const scan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !activeId || !scanVal.trim()) return;
    try {
      await scanAuditLine({
        company_id: companyId,
        audit_id: activeId,
        scanned_value: scanVal.trim(),
        result,
        scanned_by: userId,
      });
      toast.success(`${result}: ${scanVal}`);
      setScanVal("");
      await load();
      await loadLines(activeId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    }
  };

  const completeAudit = async () => {
    if (!activeId) return;
    const crudRes = await crudUpdate("ast_audits", activeId, { status: "completed", completed_at: new Date().toISOString() });
    toast.success("Audit completed");
    await load();
  };

  if (loading) return <LoadingState message="Loading audits…" />;

  const active = audits.find((a) => a.id === activeId);

  return (
    <div>
      <PageHeader
        title="Inventory Audits"
        description="QR · barcode · RFID sweep · found / missing / damaged / moved"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Start audit</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>New inventory audit</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Name</Label>
                    <Input required value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Method</Label>
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="qr">QR scan</SelectItem>
                        <SelectItem value="barcode">Barcode</SelectItem>
                        <SelectItem value="rfid">RFID sweep</SelectItem>
                        <SelectItem value="nfc">NFC tap</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Start</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium mb-2">Audits</h3>
          {audits.length === 0 ? (
            <EmptyState title="No audits" description="Start a physical inventory verification." />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Found</TableHead>
                    <TableHead>Missing</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audits.map((a) => (
                    <TableRow
                      key={String(a.id)}
                      className={activeId === a.id ? "bg-muted/50 cursor-pointer" : "cursor-pointer"}
                      onClick={() => setActiveId(String(a.id))}
                    >
                      <TableCell className="font-mono text-xs">{String(a.audit_number)}</TableCell>
                      <TableCell className="text-sm">{String(a.name)}</TableCell>
                      <TableCell>{String(a.found_count ?? 0)}</TableCell>
                      <TableCell>{String(a.missing_count ?? 0)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">{String(a.status)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="h-4 w-4" />
              {active ? `Scan — ${String(active.audit_number)}` : "Select an audit"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {active && active.status === "in_progress" && (
              <form onSubmit={scan} className="space-y-2">
                <Input
                  autoFocus
                  placeholder="Scan or type asset tag / serial / RFID"
                  value={scanVal}
                  onChange={(e) => setScanVal(e.target.value)}
                />
                <Select value={result} onValueChange={setResult}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUDIT_RESULTS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button type="submit" size="sm">Record</Button>
                  <Button type="button" size="sm" variant="outline" onClick={completeAudit}>Complete audit</Button>
                </div>
              </form>
            )}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {lines.map((l) => (
                <div key={String(l.id)} className="text-xs flex justify-between border-b py-1">
                  <span className="font-mono">{String(l.asset_tag || l.scanned_value)}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{String(l.result)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
