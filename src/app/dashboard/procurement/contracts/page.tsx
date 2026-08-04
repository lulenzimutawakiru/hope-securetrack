"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDate, formatNumber } from "@/lib/utils";

export default function ContractsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("procurement_contracts")
        .select("*, suppliers(name, code)")
        .order("end_date", { ascending: true });
      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Procurement Contracts"
        description="Framework · blanket · service · maintenance · leasing · strategic agreements"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/procurement">Hub</Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Award} title="No contracts" description="Framework agreements appear here" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Value limit</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const sup = r.suppliers as { name?: string; code?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.contract_number)}
                    </TableCell>
                    <TableCell className="font-medium">{String(r.title)}</TableCell>
                    <TableCell>
                      {sup?.code} — {sup?.name}
                    </TableCell>
                    <TableCell className="capitalize">
                      {String(r.contract_type).replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.start_date ? formatDate(String(r.start_date)) : "—"} →{" "}
                      {r.end_date ? formatDate(String(r.end_date)) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Math.round(Number(r.value_limit || 0)))}{" "}
                      {String(r.currency ?? "UGX")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
