"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Check, X } from "lucide-react";
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
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { approveProfileRequest } from "@/lib/profile";

type Req = {
  id: string;
  request_number: string;
  request_type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  employee_id: string;
  employees?: { first_name: string; last_name: string; employee_number: string } | null;
};

export default function ProfileRequestsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Req[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    let q = createClient()
      .from("profile_requests")
      .select("*, employees(first_name,last_name,employee_number)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRows((data as Req[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [filter]);

  const decide = async (id: string, approved: boolean) => {
    if (!auth?.user?.id) return;
    try {
      await approveProfileRequest(id, auth.user.id, approved);
      toast.success(approved ? "Request approved" : "Request rejected");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading profile requests…" />;

  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="Profile Requests"
        description="Self-service approvals · profile updates · ID replacement · expenses"
        actions={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Shown" value={String(rows.length)} icon={ClipboardList} />
        <StatCard title="Pending (filter set)" value={String(pending)} icon={ClipboardList} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No requests" description="Employees submit requests from My Profile self-service." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.request_number}</TableCell>
                  <TableCell className="text-sm">
                    {r.employees
                      ? `${r.employees.first_name} ${r.employees.last_name}`
                      : "—"}
                    <div className="text-xs font-mono text-muted-foreground">
                      {r.employees?.employee_number}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{r.request_type.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{r.title}</div>
                    {r.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-[220px]">{r.description}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="icon" variant="ghost">
                        <Link href={`/dashboard/profiles/${r.employee_id}`}>…</Link>
                      </Button>
                      {r.status === "pending" && (
                        <>
                          <Button size="icon" variant="ghost" title="Approve" onClick={() => decide(r.id, true)}>
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Reject" onClick={() => decide(r.id, false)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
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
