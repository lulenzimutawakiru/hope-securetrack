"use client";

import { useEffect, useState } from "react";
import { GitBranch, Check, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { APPROVAL_STAGES, advanceApproval } from "@/lib/branding";

export default function BrandApprovalsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("brand_approvals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const decide = async (id: string, approve: boolean) => {
    if (!companyId || !auth?.user?.id) return;
    try {
      const result = await advanceApproval({
        approval_id: id,
        company_id: companyId,
        approve,
        reviewer_id: auth.user.id,
        comments: approve ? "Approved" : "Rejected",
      });
      toast.success(approve ? `Advanced to ${result.stage}` : "Rejected");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading approvals…" />;

  const stageLabel = (s: string) =>
    APPROVAL_STAGES.find((x) => x.value === s)?.label || s;

  return (
    <div>
      <PageHeader
        title="Brand Approvals"
        description="Designer → Marketing → Brand Manager → Management → Published"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {APPROVAL_STAGES.filter((s) => s.value !== "rejected").map((s, i) => (
          <Badge key={s.value} variant="outline" className="text-[10px]">
            {i + 1}. {s.label}
          </Badge>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={GitBranch} title="No approvals" description="Assets and templates enter the queue on create." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell>
                    <span className="capitalize font-medium">{String(r.entity_type)}</span>
                    <span className="block text-[10px] font-mono text-muted-foreground">
                      {String(r.entity_id).slice(0, 8)}…
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{stageLabel(String(r.stage))}</TableCell>
                  <TableCell><StatusBadge status={String(r.status || "pending")} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.created_at ? formatDate(String(r.created_at)) : "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status === "pending" && r.stage !== "published" && r.stage !== "rejected" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => decide(String(r.id), true)}>
                          <Check className="h-3 w-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => decide(String(r.id), false)}>
                          <X className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </>
                    )}
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
