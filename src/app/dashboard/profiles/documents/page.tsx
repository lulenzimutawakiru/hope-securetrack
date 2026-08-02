"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, AlertTriangle } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";

type Doc = {
  id: string;
  title: string;
  doc_type: string;
  status: string;
  expires_on: string | null;
  file_name: string | null;
  file_url: string | null;
  version: number;
  employee_id: string;
  employees?: { first_name: string; last_name: string; employee_number: string } | null;
};

export default function ProfileDocumentsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Doc[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    let q = createClient()
      .from("profile_documents")
      .select("*, employees(first_name,last_name,employee_number)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);
    if (filter === "pending") q = q.eq("status", "pending_approval");
    if (filter === "expiring") {
      const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      q = q.not("expires_on", "is", null).lte("expires_on", in30);
    }
    const { data } = await q;
    setRows((data as Doc[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [filter]);

  const approve = async (id: string) => {
    const crudRes = await crudUpdate("profile_documents", id, {
        status: "active",
        approved_by: auth?.user?.id,
        approved_at: new Date().toISOString(),
      });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Document approved");
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading documents…" />;

  const pending = rows.filter((r) => r.status === "pending_approval").length;
  const expiring = rows.filter((r) => {
    if (!r.expires_on) return false;
    const d = new Date(r.expires_on).getTime() - Date.now();
    return d >= 0 && d <= 30 * 864e5;
  }).length;

  return (
    <div>
      <PageHeader
        title="Profile Documents"
        description="National ID · contracts · certificates · expiry tracking · approval"
        actions={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending approval</SelectItem>
              <SelectItem value="expiring">Expiring soon</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Documents" value={String(rows.length)} icon={FileText} />
        <StatCard title="Pending approval" value={String(pending)} icon={FileText} />
        <StatCard title="Expiring ≤ 30d" value={String(expiring)} icon={AlertTriangle} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No documents" description="Register documents from employee 360° profiles." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    {r.employees
                      ? `${r.employees.first_name} ${r.employees.last_name}`
                      : "—"}
                    <div className="text-xs font-mono text-muted-foreground">
                      {r.employees?.employee_number}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{r.title}</div>
                    {r.file_url && (
                      <a href={r.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                        Open
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="capitalize text-sm">{r.doc_type.replace(/_/g, " ")}</TableCell>
                  <TableCell>v{r.version}</TableCell>
                  <TableCell className="text-xs">{r.expires_on ? formatDate(r.expires_on) : "—"}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="space-x-1">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/profiles/${r.employee_id}`}>Profile</Link>
                    </Button>
                    {r.status === "pending_approval" && (
                      <Button size="sm" onClick={() => approve(r.id)}>Approve</Button>
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
