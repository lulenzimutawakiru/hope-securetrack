"use client";

import { useEffect, useState } from "react";
import { Plus, Landmark } from "lucide-react";
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
import {
  listBusinessUnits, createBusinessUnit, BUSINESS_UNIT_TYPES,
} from "@/lib/enterprise-company";
import { toast } from "sonner";

export default function BusinessUnitsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", unit_type: "corporate", director_name: "", budget_amount: "",
  });

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    try {
      setRows((await listBusinessUnits(auth.profile.company_id)) as Array<Record<string, unknown>>);
    } catch { /* */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [auth]);

  const save = async () => {
    if (!auth || !form.code || !form.name) return toast.error("Code and name required");
    try {
      await createBusinessUnit({
        company_id: auth.profile.company_id,
        code: form.code,
        name: form.name,
        unit_type: form.unit_type,
        director_name: form.director_name || undefined,
        budget_amount: form.budget_amount ? Number(form.budget_amount) : undefined,
      });
      toast.success("Business unit created");
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading business units…" />;

  return (
    <div>
      <PageHeader
        title="Business Units"
        description="Manufacturing · security printing · ICT · distribution · retail · corporate"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add unit</Button>}
      />
      {rows.length === 0 ? (
        <EmptyState title="No business units" description="Create manufacturing, print, or corporate units." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Director</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id as string}>
                  <TableCell className="font-mono text-xs">{String(r.code)}</TableCell>
                  <TableCell className="font-medium text-sm flex items-center gap-2">
                    <Landmark className="h-3.5 w-3.5 text-hope-navy" />{String(r.name)}
                  </TableCell>
                  <TableCell><Badge variant="outline">{String(r.unit_type)}</Badge></TableCell>
                  <TableCell className="text-xs">{String(r.director_name || "—")}</TableCell>
                  <TableCell className="text-xs">
                    {r.budget_amount != null ? `${String(r.budget_currency || "UGX")} ${Number(r.budget_amount).toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{String(r.status || "active")}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New business unit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.unit_type} onValueChange={(v) => setForm({ ...form, unit_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_UNIT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Director</Label><Input value={form.director_name} onChange={(e) => setForm({ ...form, director_name: e.target.value })} /></div>
            <div><Label>Budget</Label><Input type="number" value={form.budget_amount} onChange={(e) => setForm({ ...form, budget_amount: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
