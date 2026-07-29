"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import { listApprovals, decideApproval } from "@/lib/finance";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function FinanceApprovalsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setRows(await listApprovals());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    try {
      await decideApproval(id, decision, auth?.user.id, decision === "approved" ? "Approved" : "Rejected");
      toast.success(decision === "approved" ? "Approved with digital signature" : "Rejected");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading finance approvals…" />;

  const pending = rows.filter((r) => r.status === "pending");

  return (
    <div>
      <PageHeader
        title="Finance Approval Workflows"
        description="Journals · payments · AP invoices · budgets · CAPEX · payroll · SoD dual approval · digital signatures"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/finance">Hub</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Pending" value={String(pending.length)} icon={CheckSquare} />
        <StatCard title="Total requests" value={String(rows.length)} />
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Levels</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  No approval requests — seed after migration 00047
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {String(r.entity_type).replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="font-mono text-xs">{String(r.entity_ref)}</p>
                    <p className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                      {String(r.comments || "")}
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(Number(r.amount || 0))} {String(r.currency || "UGX")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {String(r.level_current || 0)}/{String(r.level_required || 1)}
                  </TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell>
                    {r.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" className="h-7 text-xs" onClick={() => decide(String(r.id), "approved")}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={() => decide(String(r.id), "rejected")}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                    {r.digital_signature ? (
                      <span className="text-[10px] text-muted-foreground">Signed</span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
