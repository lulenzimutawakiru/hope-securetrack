"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatNumber } from "@/lib/utils";

export default function SupplierPerformancePage() {
  const [scorecards, setScorecards] = useState<Array<Record<string, unknown>>>([]);
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data }, { data: sup }] = await Promise.all([
        supabase
          .from("supplier_scorecards")
          .select("*, suppliers(name, code)")
          .order("overall_score", { ascending: false }),
        supabase
          .from("suppliers")
          .select("code,name,on_time_delivery_pct,quality_score,risk_score,overall_score,is_approved_vendor")
          .eq("is_active", true)
          .order("overall_score", { ascending: false }),
      ]);
      setScorecards(data ?? []);
      setSuppliers(sup ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Supplier Performance"
        description="OTD · quality · price · responsiveness · order accuracy · risk · sustainability scorecards"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/procurement">Hub</Link>
          </Button>
        }
      />

      <h3 className="font-medium mb-2">Live vendor KPIs</h3>
      {suppliers.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No suppliers" description="Add vendors first" />
      ) : (
        <div className="rounded-lg border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">OTD %</TableHead>
                <TableHead className="text-right">Quality</TableHead>
                <TableHead className="text-right">Risk</TableHead>
                <TableHead className="text-right">Overall</TableHead>
                <TableHead>Vendor status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <span className="font-mono text-sm">{String(s.code)}</span>{" "}
                    {String(s.name)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(s.on_time_delivery_pct ?? 0))}%
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(s.quality_score ?? 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(s.risk_score ?? 0))}
                  </TableCell>
                  <TableCell className="text-right font-bold text-hope-teal">
                    {formatNumber(Number(s.overall_score ?? 0))}
                  </TableCell>
                  <TableCell>
                    {s.is_approved_vendor ? (
                      <Badge className="bg-green-100 text-green-800">Approved</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="font-medium mb-2">Period scorecards</h3>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">OTD</TableHead>
              <TableHead className="text-right">Quality</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Response</TableHead>
              <TableHead className="text-right">Accuracy</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead className="text-right">Overall</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scorecards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-sm text-muted-foreground">
                  No scorecards yet
                </TableCell>
              </TableRow>
            ) : (
              scorecards.map((sc) => {
                const sup = sc.suppliers as { name?: string; code?: string } | null;
                return (
                  <TableRow key={String(sc.id)}>
                    <TableCell>{String(sc.period_label)}</TableCell>
                    <TableCell>
                      {sup?.code} — {sup?.name}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(sc.on_time_pct))}%
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(sc.quality_pct))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(sc.price_competitiveness))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(sc.responsiveness))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(sc.order_accuracy))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {String(sc.risk_rating)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(Number(sc.overall_score))}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
