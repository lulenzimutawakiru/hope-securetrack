"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ClipboardCheck } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/hooks/use-user";
import {
  listNcrs,
  createNcr,
  updateNcrStatus,
  listInspections,
  createInspection,
  listSuppliers,
  qualityRecurringIssues,
} from "@/lib/srm";
import { toast } from "sonner";

export default function SrmQualityPage() {
  const { auth } = useUser();
  const [ncrs, setNcrs] = useState<Array<Record<string, unknown>>>([]);
  const [inspections, setInspections] = useState<Array<Record<string, unknown>>>([]);
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [ncrOpen, setNcrOpen] = useState(false);
  const [qiOpen, setQiOpen] = useState(false);
  const [ncrForm, setNcrForm] = useState({
    supplier_id: "",
    title: "",
    description: "",
    severity: "medium",
    defect_type: "packaging",
    quantity_affected: "1",
  });
  const [qiForm, setQiForm] = useState({
    supplier_id: "",
    result: "pass",
    defect_count: "0",
    notes: "",
  });

  const load = async () => {
    try {
      const [n, i, s] = await Promise.all([listNcrs(), listInspections(), listSuppliers({ limit: 100 })]);
      setNcrs(n);
      setInspections(i);
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

  const submitNcr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !ncrForm.supplier_id) return;
    try {
      await createNcr({
        company_id: auth.profile.company_id,
        supplier_id: ncrForm.supplier_id,
        title: ncrForm.title,
        description: ncrForm.description,
        severity: ncrForm.severity,
        defect_type: ncrForm.defect_type,
        quantity_affected: parseFloat(ncrForm.quantity_affected) || 0,
        created_by: auth.user.id,
      });
      toast.success("NCR created");
      setNcrOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const submitQi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    try {
      await createInspection({
        company_id: auth.profile.company_id,
        supplier_id: qiForm.supplier_id || null,
        result: qiForm.result,
        defect_count: parseInt(qiForm.defect_count, 10) || 0,
        notes: qiForm.notes,
        inspector_id: auth.user.id,
      });
      toast.success("Inspection recorded");
      setQiOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading quality…" />;

  const openNcrs = ncrs.filter((n) => !["closed"].includes(String(n.status)));
  const aiHint = qualityRecurringIssues(
    openNcrs.map((n) => ({ defect_type: n.defect_type as string, supplier_id: n.supplier_id as string }))
  );

  return (
    <div>
      <PageHeader
        title="Supplier Quality Management"
        description="Inspections · defects · NCR · CAPA · RTS · AI recurring-issue detection"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement">Hub</Link>
            </Button>
            <Dialog open={qiOpen} onOpenChange={setQiOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Inspection</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submitQi}>
                  <DialogHeader><DialogTitle>Quality inspection</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Supplier</Label>
                      <Select value={qiForm.supplier_id} onValueChange={(v) => setQiForm({ ...qiForm, supplier_id: v })}>
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
                        <Label>Result</Label>
                        <Select value={qiForm.result} onValueChange={(v) => setQiForm({ ...qiForm, result: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["pass", "fail", "conditional", "partial"].map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Defect count</Label>
                        <Input value={qiForm.defect_count} onChange={(e) => setQiForm({ ...qiForm, defect_count: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea value={qiForm.notes} onChange={(e) => setQiForm({ ...qiForm, notes: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={ncrOpen} onOpenChange={setNcrOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> NCR</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submitNcr}>
                  <DialogHeader><DialogTitle>Non-conformance report</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Supplier</Label>
                      <Select value={ncrForm.supplier_id} onValueChange={(v) => setNcrForm({ ...ncrForm, supplier_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={String(s.id)} value={String(s.id)}>{String(s.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input required value={ncrForm.title} onChange={(e) => setNcrForm({ ...ncrForm, title: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Severity</Label>
                        <Select value={ncrForm.severity} onValueChange={(v) => setNcrForm({ ...ncrForm, severity: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["low", "medium", "high", "critical"].map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Defect type</Label>
                        <Input value={ncrForm.defect_type} onChange={(e) => setNcrForm({ ...ncrForm, defect_type: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea value={ncrForm.description} onChange={(e) => setNcrForm({ ...ncrForm, description: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Create NCR</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <StatCard title="Open NCRs" value={String(openNcrs.length)} icon={ClipboardCheck} />
        <StatCard title="Inspections" value={String(inspections.length)} />
        <StatCard title="Fail/conditional" value={String(inspections.filter((i) => ["fail", "conditional"].includes(String(i.result))).length)} />
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm mb-6">
        {aiHint}
      </div>

      <Tabs defaultValue="ncr">
        <TabsList>
          <TabsTrigger value="ncr">NCRs / CAPA</TabsTrigger>
          <TabsTrigger value="qi">Inspections</TabsTrigger>
        </TabsList>
        <TabsContent value="ncr" className="mt-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NCR #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>CAPA due</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ncrs.map((n) => (
                  <TableRow key={String(n.id)}>
                    <TableCell className="font-mono text-xs">{String(n.ncr_number)}</TableCell>
                    <TableCell className="font-medium text-sm">{String(n.title)}</TableCell>
                    <TableCell>
                      <Badge variant={n.severity === "critical" || n.severity === "high" ? "destructive" : "secondary"}>
                        {String(n.severity)}
                      </Badge>
                    </TableCell>
                    <TableCell><StatusBadge status={String(n.status)} /></TableCell>
                    <TableCell className="text-xs">{n.capa_due_date ? String(n.capa_due_date).slice(0, 10) : "—"}</TableCell>
                    <TableCell>
                      {String(n.status) !== "closed" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateNcrStatus(String(n.id), "closed").then(load)}>
                          Close
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="qi" className="mt-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>QI #</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Defects</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.map((i) => (
                  <TableRow key={String(i.id)}>
                    <TableCell className="font-mono text-xs">{String(i.inspection_number)}</TableCell>
                    <TableCell><StatusBadge status={String(i.result)} /></TableCell>
                    <TableCell>{String(i.defect_count ?? 0)}</TableCell>
                    <TableCell className="text-sm max-w-[240px] truncate">{String(i.notes || "—")}</TableCell>
                    <TableCell className="text-xs">
                      {i.inspected_at ? new Date(String(i.inspected_at)).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
