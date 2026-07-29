"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, TrendingUp } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import {
  listOpportunities,
  createOpportunity,
  moveOpportunityStage,
  listCustomers,
  OPP_STAGES,
  forecastPipeline,
} from "@/lib/crm";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function CrmOpportunitiesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    customer_id: "",
    expected_value: "50000000",
    probability: "40",
    stage: "prospecting",
    expected_close_date: "",
    win_strategy: "",
    competitors: "",
  });

  const load = async () => {
    try {
      const [o, c] = await Promise.all([listOpportunities(), listCustomers({ limit: 100 })]);
      setRows(o);
      setCustomers(c);
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
      await createOpportunity(
        {
          company_id: auth.profile.company_id,
          name: form.name,
          customer_id: form.customer_id || null,
          expected_value: parseFloat(form.expected_value) || 0,
          probability: parseInt(form.probability, 10) || 20,
          stage: form.stage,
          expected_close_date: form.expected_close_date || undefined,
          win_strategy: form.win_strategy || undefined,
          competitors: form.competitors || undefined,
        },
        auth.user.id
      );
      toast.success("Opportunity created");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  };

  const move = async (id: string, stage: string) => {
    try {
      await moveOpportunityStage(id, stage);
      toast.success(`Moved to ${stage}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  if (loading) return <LoadingState message="Loading opportunities…" />;

  const forecast = forecastPipeline(
    rows.map((r) => ({
      expected_value: Number(r.expected_value),
      probability: Number(r.probability),
      stage: String(r.stage),
    }))
  );

  return (
    <div>
      <PageHeader
        title="Opportunity Management"
        description="Value · probability · competitors · win strategy · forecast categories"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/crm/pipeline">Kanban</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New opportunity</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Create opportunity</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Name</Label>
                      <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Customer</Label>
                      <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={String(c.id)} value={String(c.id)}>
                              {String(c.name)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>Value</Label>
                        <Input value={form.expected_value} onChange={(e) => setForm({ ...form, expected_value: e.target.value })} />
                      </div>
                      <div>
                        <Label>Probability %</Label>
                        <Input value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} />
                      </div>
                      <div>
                        <Label>Close date</Label>
                        <Input type="date" value={form.expected_close_date} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Win strategy</Label>
                      <Input value={form.win_strategy} onChange={(e) => setForm({ ...form, win_strategy: e.target.value })} />
                    </div>
                    <div>
                      <Label>Competitors</Label>
                      <Input value={form.competitors} onChange={(e) => setForm({ ...form, competitors: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Create</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Pipeline" value={formatNumber(Math.round(forecast.totalPipeline))} icon={TrendingUp} />
        <StatCard title="Weighted" value={formatNumber(Math.round(forecast.weightedForecast))} />
        <StatCard title="Commit" value={formatNumber(Math.round(forecast.commit))} />
        <StatCard title="Best case" value={formatNumber(Math.round(forecast.bestCase))} />
      </div>
      <p className="text-xs text-muted-foreground mb-4">{forecast.winRateHint}</p>

      {rows.length === 0 ? (
        <EmptyState title="No opportunities" description="Create deals linked to accounts." />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opp #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>%</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Weighted</TableHead>
                <TableHead>Close</TableHead>
                <TableHead>Move</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.opportunity_number)}</TableCell>
                  <TableCell className="font-medium text-sm max-w-[220px] truncate">{String(r.name)}</TableCell>
                  <TableCell><StatusBadge status={String(r.stage)} /></TableCell>
                  <TableCell>{String(r.probability ?? 0)}%</TableCell>
                  <TableCell className="text-right">{formatNumber(Number(r.expected_value || 0))}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatNumber(Number(r.weighted_value ?? (Number(r.expected_value || 0) * Number(r.probability || 0)) / 100))}
                  </TableCell>
                  <TableCell className="text-xs">{r.expected_close_date ? String(r.expected_close_date).slice(0, 10) : "—"}</TableCell>
                  <TableCell>
                    <Select onValueChange={(v) => move(String(r.id), v)}>
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue placeholder="Stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {OPP_STAGES.map((s) => (
                          <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
