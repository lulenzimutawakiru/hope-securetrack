"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitBranch, Check, X, Play, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";
import { advanceProvisionApproval, activateProvisionRequest } from "@/lib/idm";

export default function ProvisionQueuePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastPassword, setLastPassword] = useState<string | null>(null);

  const load = async () => {
    let q = createClient()
      .from("idm_provision_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter === "open") {
      q = q.not("status", "in", '("activated","rejected","cancelled")');
    } else if (filter !== "all") {
      q = q.eq("status", filter);
    }
    const { data } = await q;
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [filter]);

  const act = async (id: string, step: "manager" | "security" | "admin" | "reject" | "activate") => {
    if (!auth?.user?.id) return;
    setBusy(id);
    setLastPassword(null);
    try {
      if (step === "activate") {
        const crudRes = await crudUpdate("idm_provision_requests", id, {
            status: "admin_approved",
            admin_approved_by: auth.user.id,
            admin_approved_at: new Date().toISOString(),
          });
        const result = await activateProvisionRequest(id, auth.user.id);
        setLastPassword(result.temp_password || null);
        toast.success(`Activated ${result.email}`);
      } else {
        await advanceProvisionApproval({
          request_id: id,
          actor_id: auth.user.id,
          step,
          reason: step === "reject" ? "Rejected by approver" : undefined,
        });
        toast.success(step === "reject" ? "Rejected" : `Step: ${step}`);
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <LoadingState message="Loading provisioning queue…" />;

  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="Account Provisioning Queue"
        description="Manager → Security → Admin → Activate · temp password · lifecycle"
        actions={
          <div className="flex gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="security_review">Security review</SelectItem>
                <SelectItem value="admin_approved">Admin approved</SelectItem>
                <SelectItem value="activated">Activated</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild size="sm">
              <Link href="/dashboard/identity/create"><UserPlus className="h-4 w-4 mr-1" /> New</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="In view" value={String(rows.length)} icon={GitBranch} />
        <StatCard title="Pending manager" value={String(pending)} icon={GitBranch} />
      </div>

      {lastPassword && (
        <Card className="mb-4 border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4 text-sm">
            <p className="font-medium">Temporary password issued</p>
            <code className="block mt-1 font-mono text-sm border rounded px-2 py-1 bg-background">{lastPassword}</code>
            <p className="text-xs text-muted-foreground mt-1">Share securely. User must change on first login.</p>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No requests" description="Create accounts from Create Account or HR onboarding." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">{String(r.request_number)}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{String(r.first_name)} {String(r.last_name)}</div>
                    <div className="text-xs text-muted-foreground">{String(r.email)}</div>
                    <div className="text-xs font-mono">{String(r.username || "")}</div>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{String(r.user_type)}</TableCell>
                  <TableCell className="text-xs capitalize">{String(r.source).replace(/_/g, " ")}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell className="text-xs">{r.created_at ? formatDate(String(r.created_at)) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {r.status === "pending" && (
                        <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => act(String(r.id), "manager")}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Manager
                        </Button>
                      )}
                      {r.status === "security_review" && (
                        <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => act(String(r.id), "security")}>
                          Security
                        </Button>
                      )}
                      {(r.status === "manager_approved" || r.status === "security_review" || r.status === "admin_approved" || r.status === "pending") && (
                        <Button size="sm" disabled={busy === r.id} onClick={() => act(String(r.id), "activate")}>
                          <Play className="h-3.5 w-3.5 mr-1" /> Activate
                        </Button>
                      )}
                      {!["activated", "rejected", "cancelled"].includes(String(r.status)) && (
                        <Button size="icon" variant="ghost" disabled={busy === r.id} onClick={() => act(String(r.id), "reject")}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
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
