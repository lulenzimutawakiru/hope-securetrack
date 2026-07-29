"use client";

import { useEffect, useState } from "react";
import { Users, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { syncEmployeeProfile } from "@/lib/payroll";

export default function PayProfilesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [syncing, setSyncing] = useState(false);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("pay_employee_profiles")
      .select("*, employees(first_name,last_name,employee_number,department,job_title,status)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const syncAll = async () => {
    if (!companyId) return;
    setSyncing(true);
    try {
      const { data: emps } = await createClient()
        .from("employees")
        .select("id,salary,grade,nssf_number,tin_number,bank_account,bank_name")
        .eq("status", "active");
      let n = 0;
      for (const e of emps || []) {
        await syncEmployeeProfile({
          company_id: companyId,
          employee_id: e.id,
          basic_salary: Number(e.salary || 0),
          salary_grade: e.grade || undefined,
          nssf_number: e.nssf_number || undefined,
          tin_number: e.tin_number || undefined,
          bank_account: e.bank_account || undefined,
          bank_name: e.bank_name || undefined,
        });
        n += 1;
      }
      toast.success(`Synced ${n} employee payroll profiles`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    const emp = r.employees as { first_name?: string; last_name?: string; employee_number?: string } | null;
    const name = `${emp?.first_name || ""} ${emp?.last_name || ""} ${emp?.employee_number || ""}`.toLowerCase();
    return name.includes(s) || String(r.salary_grade || "").toLowerCase().includes(s);
  });

  if (loading) return <LoadingState message="Loading pay profiles…" />;

  return (
    <div>
      <PageHeader
        title="Employee Payroll Profiles"
        description="Basic · bank · TIN · NSSF · grade · cost center · payment method"
        actions={
          <Button size="sm" onClick={syncAll} disabled={syncing}>
            <RefreshCw className="h-4 w-4 mr-1" /> {syncing ? "Syncing…" : "Sync from HR"}
          </Button>
        }
      />

      <div className="mb-4">
        <Input placeholder="Search employee…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No payroll profiles"
          description="Sync active employees from HR to create pay profiles."
          action={<Button size="sm" onClick={syncAll}>Sync from HR</Button>}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const emp = r.employees as {
                  first_name?: string; last_name?: string; employee_number?: string; department?: string; status?: string;
                } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell>
                      <div className="font-medium text-sm">
                        {emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {emp?.employee_number} · {emp?.department || ""}
                      </div>
                    </TableCell>
                    <TableCell>{String(r.salary_grade || "—")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{String(r.country_code || "UG")}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatNumber(Number(r.basic_salary || 0))}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {String(r.bank_account || "—")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.is_active ? "default" : "outline"}>
                        {r.is_active ? "Active" : "Inactive"}
                      </Badge>
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
