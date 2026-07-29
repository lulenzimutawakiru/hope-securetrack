"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ShieldAlert } from "lucide-react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import { listRisks, createRisk, listSuppliers, refreshSupplierRisk } from "@/lib/srm";
import { toast } from "sonner";

const RISK_TYPES = ["financial", "compliance", "supply", "country", "operational", "cyber", "esg"];

export default function SrmRiskPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    supplier_id: "",
    risk_type: "supply",
    title: "",
    description: "",
    likelihood: "3",
    impact: "3",
    mitigation: "",
  });

  const load = async () => {
    try {
      const [r, s] = await Promise.all([listRisks(), listSuppliers({ limit: 100 })]);
      setRows(r);
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
    if (!auth) return;
    try {
      await createRisk({
        company_id: auth.profile.company_id,
        supplier_id: form.supplier_id || null,
        risk_type: form.risk_type,
        title: form.title,
        description: form.description,
        likelihood: parseInt(form.likelihood, 10),
        impact: parseInt(form.impact, 10),
        mitigation: form.mitigation,
        owner_id: auth.user.id,
      });
      toast.success("Risk registered");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const refresh = async (supplierId: string) => {
    try {
      const r = await refreshSupplierRisk(supplierId);
      toast.success(`Disruption risk → ${r.disruption_risk}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading risk register…" />;

  const openRisks = rows.filter((r) => r.status === "open");
  const high = openRisks.filter((r) => Number(r.risk_score || 0) >= 12);

  return (
    <div>
      <PageHeader
        title="Supplier Risk Management"
        description="Financial · compliance · supply · country · operational · cyber · ESG · AI disruption"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Log risk</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Register risk</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Supplier</Label>
                      <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={String(s.id)} value={String(s.id)}>{String(s.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>Type</Label>
                        <Select value={form.risk_type} onValueChange={(v) => setForm({ ...form, risk_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RISK_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Likelihood 1–5</Label>
                        <Input type="number" min={1} max={5} value={form.likelihood} onChange={(e) => setForm({ ...form, likelihood: e.target.value })} />
                      </div>
                      <div>
                        <Label>Impact 1–5</Label>
                        <Input type="number" min={1} max={5} value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div>
                      <Label>Mitigation</Label>
                      <Textarea value={form.mitigation} onChange={(e) => setForm({ ...form, mitigation: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Open risks" value={String(openRisks.length)} icon={ShieldAlert} />
        <StatCard title="High score (≥12)" value={String(high.length)} />
        <StatCard title="Total register" value={String(rows.length)} />
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Risk</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mitigation</TableHead>
              <TableHead>AI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const sup = r.suppliers as { name?: string } | null;
              return (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-medium text-sm max-w-[200px]">{String(r.title)}</TableCell>
                  <TableCell className="text-sm">{sup?.name || "—"}</TableCell>
                  <TableCell className="capitalize text-xs">{String(r.risk_type)}</TableCell>
                  <TableCell>
                    <Badge variant={Number(r.risk_score) >= 12 ? "destructive" : "secondary"}>
                      {String(r.risk_score)} ({String(r.likelihood)}×{String(r.impact)})
                    </Badge>
                  </TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{String(r.mitigation || "—")}</TableCell>
                  <TableCell>
                    {r.supplier_id ? (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => refresh(String(r.supplier_id))}>
                        Refresh
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
