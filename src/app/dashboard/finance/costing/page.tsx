"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Factory } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import { listCostRolls, createCostRoll, listWip, PRODUCT_LINES } from "@/lib/finance";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function FinanceCostingPage() {
  const { auth } = useUser();
  const [rolls, setRolls] = useState<Array<Record<string, unknown>>>([]);
  const [wip, setWip] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    product_name: "",
    product_line: "security_print",
    production_order_ref: "",
    batch_qty: "5000",
    direct_materials: "100000000",
    direct_labor: "25000000",
    factory_overhead: "20000000",
    machine_cost: "15000000",
    utility_cost: "8000000",
    packaging_cost: "6000000",
    scrap_cost: "2000000",
    standard_cost: "170000000",
  });

  const load = async () => {
    try {
      const [r, w] = await Promise.all([listCostRolls(), listWip()]);
      setRolls(r);
      setWip(w);
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
      await createCostRoll({
        company_id: auth.profile.company_id,
        product_name: form.product_name,
        product_line: form.product_line,
        production_order_ref: form.production_order_ref,
        batch_qty: parseFloat(form.batch_qty) || 0,
        reams_per_batch: parseFloat(form.batch_qty) || 0,
        direct_materials: parseFloat(form.direct_materials) || 0,
        direct_labor: parseFloat(form.direct_labor) || 0,
        factory_overhead: parseFloat(form.factory_overhead) || 0,
        machine_cost: parseFloat(form.machine_cost) || 0,
        utility_cost: parseFloat(form.utility_cost) || 0,
        packaging_cost: parseFloat(form.packaging_cost) || 0,
        scrap_cost: parseFloat(form.scrap_cost) || 0,
        standard_cost: parseFloat(form.standard_cost) || 0,
        created_by: auth.user.id,
      });
      toast.success("Cost roll created with paper unit costs");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading manufacturing costing…" />;

  const totalCost = rolls.reduce((s, r) => s + Number(r.total_cost || 0), 0);
  const totalVar = rolls.reduce((s, r) => s + Number(r.variance_amount || 0), 0);

  return (
    <div>
      <PageHeader
        title="Manufacturing & Paper Costing"
        description="Materials · labor · OH · machine · scrap · cost/sheet · ream · box · pallet · ton · WIP"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/production">Production</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Cost roll</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Create cost roll-up</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Product</Label>
                      <Input required value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Product line</Label>
                        <Select value={form.product_line} onValueChange={(v) => setForm({ ...form, product_line: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PRODUCT_LINES.map((p) => (
                              <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Batch qty (reams)</Label>
                        <Input value={form.batch_qty} onChange={(e) => setForm({ ...form, batch_qty: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Production order ref</Label>
                      <Input value={form.production_order_ref} onChange={(e) => setForm({ ...form, production_order_ref: e.target.value })} />
                    </div>
                    {(
                      [
                        ["direct_materials", "Direct materials"],
                        ["direct_labor", "Direct labor"],
                        ["factory_overhead", "Factory OH"],
                        ["machine_cost", "Machine cost"],
                        ["utility_cost", "Utilities"],
                        ["packaging_cost", "Packaging"],
                        ["scrap_cost", "Scrap"],
                        ["standard_cost", "Standard cost"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <Label>{label}</Label>
                        <Input
                          value={form[key]}
                          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                  <DialogFooter><Button type="submit">Calculate</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Cost rolls" value={String(rolls.length)} icon={Factory} />
        <StatCard title="Total actual cost" value={formatNumber(Math.round(totalCost))} />
        <StatCard title="Total variance" value={formatNumber(Math.round(totalVar))} />
      </div>

      <Tabs defaultValue="rolls">
        <TabsList>
          <TabsTrigger value="rolls">Cost rolls</TabsTrigger>
          <TabsTrigger value="units">Unit costs</TabsTrigger>
          <TabsTrigger value="wip">WIP</TabsTrigger>
        </TabsList>
        <TabsContent value="rolls" className="mt-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll #</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Line</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Standard</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolls.map((r) => (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">{String(r.roll_number)}</TableCell>
                    <TableCell className="font-medium text-sm">{String(r.product_name)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {String(r.product_line || "").replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(Number(r.total_cost || 0))}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatNumber(Number(r.standard_cost || 0))}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        Number(r.variance_amount || 0) > 0 ? "text-destructive" : "text-emerald-600"
                      }`}
                    >
                      {formatNumber(Number(r.variance_amount || 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="units" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rolls.map((r) => (
              <Card key={String(r.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{String(r.product_name)}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <div className="flex justify-between"><span>Per sheet</span><span>{Number(r.cost_per_sheet || 0)}</span></div>
                  <div className="flex justify-between"><span>Per ream</span><span>{formatNumber(Number(r.cost_per_ream || 0))}</span></div>
                  <div className="flex justify-between"><span>Per box (5 reams)</span><span>{formatNumber(Number(r.cost_per_box || 0))}</span></div>
                  <div className="flex justify-between"><span>Per pallet</span><span>{formatNumber(Number(r.cost_per_pallet || 0))}</span></div>
                  <div className="flex justify-between"><span>Per ton</span><span>{formatNumber(Number(r.cost_per_ton || 0))}</span></div>
                  <div className="flex justify-between font-semibold"><span>Per batch/order</span><span>{formatNumber(Number(r.cost_per_batch || 0))}</span></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="wip" className="mt-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Added</TableHead>
                  <TableHead className="text-right">To FG</TableHead>
                  <TableHead className="text-right">Closing WIP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wip.map((w) => (
                  <TableRow key={String(w.id)}>
                    <TableCell className="font-mono text-xs">{String(w.production_order_ref)}</TableCell>
                    <TableCell className="text-sm">{String(w.product_name || "—")}</TableCell>
                    <TableCell className="text-right">{formatNumber(Number(w.opening_wip || 0))}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(
                        Number(w.materials_added || 0) +
                          Number(w.labor_added || 0) +
                          Number(w.overhead_added || 0)
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(Number(w.transferred_to_fg || 0))}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatNumber(Number(w.closing_wip || 0))}
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
