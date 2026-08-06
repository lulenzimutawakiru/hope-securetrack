"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scale, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function RegulatoryPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    package_code: "",
    name: "",
    authority: "URA",
    filing_frequency: "monthly",
    due_day: "15",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("bi_regulatory_packages")
      .select("*")
      .order("package_code");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const crudRes3 = await crudCreate("bi_regulatory_packages", {
      company_id: auth.profile.company_id,
      package_code: form.package_code.toUpperCase(),
      name: form.name,
      authority: form.authority,
      filing_frequency: form.filing_frequency,
      due_day: Number(form.due_day) || 15,
      checklist: [
        { item: "Extract source data", done: false },
        { item: "Reconcile", done: false },
        { item: "Management review", done: false },
        { item: "File / submit", done: false },
      ],
      is_active: true,
    });
    if (!crudRes3.ok) toast.error(crudRes3.error);
    else {
      toast.success("Package created");
      setOpen(false);
      load();
    }
  };

  const markFiled = async (id: string) => {
    const crudRes2 = await crudUpdate("bi_regulatory_packages", id, { last_filed_at: new Date().toISOString() });
    if (!crudRes2.ok) toast.error(crudRes2.error);
    else {
      toast.success("Marked filed");
      load();
    }
  };

  const toggleCheck = async (pkg: Record<string, unknown>, index: number) => {
    const checklist = Array.isArray(pkg.checklist)
      ? [...(pkg.checklist as Array<{ item: string; done: boolean }>)]
      : [];
    if (!checklist[index]) return;
    checklist[index] = { ...checklist[index], done: !checklist[index].done };
    const crudRes = await crudUpdate("bi_regulatory_packages", String(pkg.id), { checklist });
    if (!crudRes.ok) toast.error(crudRes.error);
    else load();
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Regulatory Reporting"
        description="URA VAT · PAYE · NSSF · internal audit packs · filing checklists"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/finance/tax">Tax codes</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Package
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>New regulatory package</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Code</Label>
                      <Input
                        value={form.package_code}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, package_code: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Authority</Label>
                      <Input
                        value={form.authority}
                        onChange={(e) => setForm((f) => ({ ...f, authority: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Frequency</Label>
                      <Input
                        value={form.filing_frequency}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, filing_frequency: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Due day</Label>
                      <Input
                        type="number"
                        value={form.due_day}
                        onChange={(e) => setForm((f) => ({ ...f, due_day: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Scale} title="No packages" description="Configure statutory filings" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const checklist = Array.isArray(r.checklist)
              ? (r.checklist as Array<{ item: string; done: boolean }>)
              : [];
            const done = checklist.filter((c) => c.done).length;
            return (
              <Card key={String(r.id)}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{String(r.name)}</CardTitle>
                    <Badge variant="outline">{String(r.authority)}</Badge>
                    <Badge variant="secondary" className="capitalize text-[10px]">
                      {String(r.filing_frequency)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {String(r.package_code)} · due day {String(r.due_day ?? "—")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Checklist {done}/{checklist.length}
                    {r.last_filed_at
                      ? ` · last filed ${new Date(String(r.last_filed_at)).toLocaleDateString()}`
                      : " · never filed"}
                  </p>
                  <ul className="space-y-1">
                    {checklist.map((c, i) => (
                      <li key={i}>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(c.done)}
                            onChange={() => toggleCheck(r, i)}
                          />
                          <span className={c.done ? "line-through text-muted-foreground" : ""}>
                            {c.item}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <Button size="sm" variant="outline" onClick={() => markFiled(String(r.id))}>
                    Mark filed
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
