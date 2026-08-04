"use client";

import { useEffect, useState } from "react";
import { Layers, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { apiPost } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function PayStructuresPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [lines, setLines] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    structure_code: "",
    name: "",
    grade: "",
    basic_amount: "",
    description: "",
  });

  const load = async () => {
    const { data } = await createClient()
      .from("pay_salary_structures")
      .select("*")
      .is("deleted_at", null)
      .order("structure_code");
    setRows((data as Array<Record<string, unknown>>) || []);
    if (data?.[0]) await loadLines(String(data[0].id));
    setLoading(false);
  };

  const loadLines = async (id: string) => {
    const { data } = await createClient()
      .from("pay_structure_lines")
      .select("*")
      .eq("structure_id", id)
      .order("sort_order");
    setLines((data as Array<Record<string, unknown>>) || []);
    setSelected(id);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiPost("/api/payroll/structures", {
      structure_code: form.structure_code || `STR-${Date.now().toString(36).toUpperCase()}`,
      name: form.name,
      grade: form.grade || null,
      basic_amount: Number(form.basic_amount) || 0,
      description: form.description || null,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Structure created");
      setOpen(false);
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading structures…" />;

  return (
    <div>
      <PageHeader
        title="Salary Structures"
        description="Basic + allowances packages by grade"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New structure</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Create salary structure</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Code</Label>
                    <Input value={form.structure_code} onChange={(e) => setForm((f) => ({ ...f, structure_code: e.target.value }))} placeholder="STR-OPS" />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Grade</Label>
                      <Input value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Basic amount</Label>
                      <Input type="number" value={form.basic_amount} onChange={(e) => setForm((f) => ({ ...f, basic_amount: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Layers} title="No structures" description="Define grade-based salary packages." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            {rows.map((s) => (
              <button
                key={String(s.id)}
                type="button"
                onClick={() => loadLines(String(s.id))}
                className={`w-full text-left rounded-md border p-3 hover:bg-muted/50 ${selected === String(s.id) ? "border-primary bg-primary/5" : ""}`}
              >
                <div className="flex justify-between">
                  <span className="font-medium text-sm">{String(s.name)}</span>
                  <Badge variant="outline">{String(s.grade || "—")}</Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{String(s.structure_code)}</p>
                <p className="text-sm mt-1">Basic {formatNumber(Number(s.basic_amount || 0))}</p>
              </button>
            ))}
          </div>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Structure components</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Select a structure</p>
              ) : (
                lines.map((l) => (
                  <div key={String(l.id)} className="flex justify-between border-b pb-2 text-sm">
                    <span className="font-mono">{String(l.component_code)}</span>
                    <span>
                      {l.is_percentage
                        ? `${l.pct_of_basic}% of basic`
                        : formatNumber(Number(l.amount || 0))}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
