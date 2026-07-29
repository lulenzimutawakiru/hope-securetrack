"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import { listCustomers, setCreditHold, updateCreditLimit } from "@/lib/crm";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function CrmCreditPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [editLimit, setEditLimit] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      setRows(await listCustomers({ limit: 200 }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleHold = async (id: string, currentlyHeld: boolean) => {
    if (!auth) return;
    try {
      await setCreditHold(id, !currentlyHeld, auth.profile.company_id, auth.user.id);
      toast.success(currentlyHeld ? "Hold released" : "Credit hold applied");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const saveLimit = async (id: string) => {
    if (!auth) return;
    const val = parseFloat(editLimit[id] || "0");
    try {
      await updateCreditLimit(id, val, auth.profile.company_id, auth.user.id);
      toast.success("Credit limit updated");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading credit…" />;

  const onHold = rows.filter((r) => r.credit_hold || r.credit_status === "hold").length;
  const totalExposure = rows.reduce((s, r) => s + Number(r.outstanding_balance || 0), 0);
  const totalLimits = rows.reduce((s, r) => s + Number(r.credit_limit || 0), 0);

  return (
    <div>
      <PageHeader
        title="Customer Credit Management"
        description="Limits · payment terms · holds · aging · risk scores · automatic alerts"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/sales/credit">Sales credit reviews</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Total credit limits" value={formatNumber(totalLimits)} icon={CreditCard} />
        <StatCard title="Outstanding" value={formatNumber(totalExposure)} />
        <StatCard title="On hold" value={String(onHold)} icon={AlertTriangle} />
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Terms</TableHead>
              <TableHead className="text-right">Limit</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const util =
                Number(r.credit_limit || 0) > 0
                  ? Math.round((Number(r.outstanding_balance || 0) / Number(r.credit_limit)) * 100)
                  : 0;
              return (
                <TableRow key={String(r.id)}>
                  <TableCell>
                    <div className="font-medium text-sm">{String(r.name)}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{String(r.code)}</div>
                  </TableCell>
                  <TableCell className="text-sm">{String(r.payment_terms_days || 30)} days</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Input
                        className="h-8 w-28 text-right text-xs"
                        value={editLimit[String(r.id)] ?? String(r.credit_limit || 0)}
                        onChange={(e) =>
                          setEditLimit({ ...editLimit, [String(r.id)]: e.target.value })
                        }
                      />
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => saveLimit(String(r.id))}>
                        Save
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(Number(r.outstanding_balance || 0))}
                    {util > 0 && (
                      <div className="text-[10px] text-muted-foreground">{util}% util</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={Number(r.risk_score || 50) > 70 ? "destructive" : "secondary"}>
                      {String(r.risk_score ?? 50)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={String(r.credit_hold ? "hold" : r.credit_status || "ok")} />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={r.credit_hold ? "default" : "outline"}
                      className="h-8 text-xs"
                      onClick={() => toggleHold(String(r.id), !!r.credit_hold)}
                    >
                      {r.credit_hold ? "Release" : "Hold"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
