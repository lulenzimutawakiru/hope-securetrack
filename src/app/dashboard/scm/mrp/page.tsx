"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cog, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function MrpPage() {
  const { auth } = useUser();
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [recs, setRecs] = useState<Array<Record<string, unknown>>>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("mrp_runs")
      .select("*")
      .order("run_date", { ascending: false })
      .limit(20);
    setRuns(data ?? []);
    if (data?.[0] && !selectedRun) {
      loadRecs(String(data[0].id));
    }
    setLoading(false);
  };

  const loadRecs = async (runId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("mrp_recommendations")
      .select("*, products(product_code, name)")
      .eq("mrp_run_id", runId)
      .order("priority");
    setRecs(data ?? []);
    setSelectedRun(runId);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runMrp = async () => {
    if (!auth) return;
    setRunning(true);
    const supabase = createClient();
    const code = `MRP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Snapshot low-stock products into recommendations
    const { data: products } = await supabase
      .from("products")
      .select("id,name,product_code,reorder_level,safety_stock,reorder_qty")
      .eq("is_active", true)
      .limit(50);

    const { data: bals } = await supabase
      .from("stock_balances")
      .select("product_id, quantity_on_hand, warehouse_id");

    const { data: run, error } = await supabase
      .from("mrp_runs")
      .insert({
        company_id: auth.profile.company_id,
        run_code: code,
        horizon_days: 90,
        status: "completed",
        notes: "On-demand MRP from inventory netting",
        created_by: auth.profile.id,
      })
      .select("id")
      .single();

    if (error || !run) {
      toast.error(error?.message ?? "MRP failed");
      setRunning(false);
      return;
    }

    let count = 0;
    for (const p of products ?? []) {
      const onHand = (bals ?? [])
        .filter((b) => b.product_id === p.id)
        .reduce((s, b) => s + Number(b.quantity_on_hand || 0), 0);
      const safety = Number(p.safety_stock || p.reorder_level || 0);
      if (safety > 0 && onHand <= safety) {
        const qty = Number(p.reorder_qty || Math.max(safety * 2 - onHand, 1));
        await supabase.from("mrp_recommendations").insert({
          mrp_run_id: run.id,
          company_id: auth.profile.company_id,
          product_id: p.id,
          item_description: p.name,
          action: "purchase",
          quantity: qty,
          due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          on_hand: onHand,
          demand: safety,
          safety_stock: safety,
          net_requirement: qty,
          priority: onHand === 0 ? "high" : "medium",
          status: "open",
        });
        count++;
      }
    }

    await supabase
      .from("mrp_runs")
      .update({ recommendations_count: count })
      .eq("id", run.id);

    toast.success(`MRP ${code}: ${count} recommendation(s)`);
    setRunning(false);
    load();
    loadRecs(run.id);
  };

  const releaseToPr = async (rec: Record<string, unknown>) => {
    if (!auth || rec.action !== "purchase") {
      toast.error("Only purchase actions release to PR");
      return;
    }
    const supabase = createClient();
    const num = `PR-MRP-${String(Date.now()).slice(-6)}`;
    const { data: pr, error } = await supabase
      .from("purchase_requisitions")
      .insert({
        company_id: auth.profile.company_id,
        requisition_number: num,
        product_id: rec.product_id,
        quantity: rec.quantity,
        reason: `Released from MRP: ${String(rec.item_description)}`,
        source: "mrp",
        status: "submitted",
        priority: rec.priority,
        created_by: auth.profile.id,
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    await supabase
      .from("mrp_recommendations")
      .update({
        status: "released",
        released_document_type: "purchase_requisition",
        released_document_id: pr?.id,
      })
      .eq("id", rec.id);

    toast.success(`Released to ${num}`);
    if (selectedRun) loadRecs(selectedRun);
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Material Requirements Planning"
        description="BOM · inventory · open PO/SO · safety stock → purchase · produce · transfer"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/scm">Hub</Link>
            </Button>
            <Button size="sm" onClick={runMrp} disabled={running}>
              <Play className="h-4 w-4 mr-1" />
              {running ? "Running…" : "Run MRP"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border overflow-x-auto lg:col-span-1">
          {runs.length === 0 ? (
            <EmptyState icon={Cog} title="No MRP runs" description="Run net requirements" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Recs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow
                    key={String(r.id)}
                    className="cursor-pointer"
                    onClick={() => loadRecs(String(r.id))}
                  >
                    <TableCell>
                      <div className="font-mono text-sm">{String(r.run_code)}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.run_date ? formatDateTime(String(r.run_date)) : "—"}
                      </div>
                    </TableCell>
                    <TableCell>{formatNumber(Number(r.recommendations_count))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="lg:col-span-2 rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Net req</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-sm text-muted-foreground">
                    Select a run or execute MRP
                  </TableCell>
                </TableRow>
              ) : (
                recs.map((r) => {
                  const prod = r.products as { product_code?: string } | null;
                  return (
                    <TableRow key={String(r.id)}>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {prod?.product_code ?? ""} {String(r.item_description)}
                        </div>
                        {r.suggested_supplier != null && r.suggested_supplier !== "" && (
                          <div className="text-xs text-muted-foreground">
                            {String(r.suggested_supplier)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {String(r.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(Number(r.quantity))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(Number(r.on_hand))}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(Number(r.net_requirement))}
                      </TableCell>
                      <TableCell>
                        {r.due_date ? formatDate(String(r.due_date)) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={String(r.priority)} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={String(r.status)} />
                      </TableCell>
                      <TableCell>
                        {String(r.status) === "open" && String(r.action) === "purchase" && (
                          <Button size="sm" variant="outline" onClick={() => releaseToPr(r)}>
                            Release PR
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
