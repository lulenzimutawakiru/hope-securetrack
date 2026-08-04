"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";

export default function CommissionsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("sales_commissions")
      .select(
        "*, sales_orders(order_number), user_profiles:sales_rep_id(first_name,last_name,email)"
      )
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const accrued = rows
      .filter((r) => r.status === "accrued")
      .reduce((s, r) => s + Number(r.commission_amount || 0), 0);
    const paid = rows
      .filter((r) => r.status === "paid")
      .reduce((s, r) => s + Number(r.commission_amount || 0), 0);
    return { accrued, paid, count: rows.length };
  }, [rows]);

  const markPaid = async (id: string) => {
    const supabase = createClient();
    const crudRes = await crudUpdate("sales_commissions", id, { status: "paid", paid_at: new Date().toISOString() });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Commission marked paid");
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Sales Commissions"
        description="Auto-accrual on confirmed orders (default 3%) · pay after collection policy ready"
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Entries" value={formatNumber(totals.count)} icon={Trophy} />
        <StatCard
          title="Accrued"
          value={`UGX ${formatNumber(Math.round(totals.accrued))}`}
        />
        <StatCard
          title="Paid"
          value={`UGX ${formatNumber(Math.round(totals.paid))}`}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No commissions yet"
          description="Commissions accrue when sales orders are confirmed"
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rep</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Basis</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const rep = r.user_profiles as {
                  first_name: string;
                  last_name: string;
                } | null;
                const so = r.sales_orders as { order_number: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell>
                      {rep
                        ? `${rep.first_name} ${rep.last_name}`
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {so?.order_number ?? "—"}
                    </TableCell>
                    <TableCell>
                      UGX {formatNumber(Number(r.basis_amount || 0))}
                    </TableCell>
                    <TableCell>{String(r.commission_pct)}%</TableCell>
                    <TableCell className="font-medium">
                      UGX {formatNumber(Number(r.commission_amount || 0))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "accrued" && (
                        <Button size="sm" onClick={() => markPaid(String(r.id))}>
                          Mark paid
                        </Button>
                      )}
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
