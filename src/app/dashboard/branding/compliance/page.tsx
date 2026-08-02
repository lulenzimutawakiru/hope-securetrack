"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, ScanSearch, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate } from "@/lib/utils";
import { crudUpdate } from "@/lib/api/crud-client";
import { toast } from "sonner";
import { runComplianceScan } from "@/lib/branding";

export default function BrandCompliancePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("brand_compliance_issues")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const scan = async () => {
    if (!companyId) return;
    setScanning(true);
    try {
      const findings = await runComplianceScan(companyId);
      toast.success(`Scan complete — ${findings.length} finding(s)`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const resolve = async (id: string) => {
    const res = await crudUpdate("brand_compliance_issues", id, {
      status: "resolved",
      resolved_at: new Date().toISOString(),
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Issue resolved");
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading compliance…" />;

  const open = rows.filter((r) => r.status === "open");
  const high = open.filter((r) => r.severity === "high" || r.severity === "critical");

  return (
    <div>
      <PageHeader
        title="Brand Compliance"
        description="Wrong logos · colors · outdated templates · missing legal · expiry"
        actions={
          <Button size="sm" onClick={scan} disabled={scanning}>
            <ScanSearch className="h-4 w-4 mr-1" />
            {scanning ? "Scanning…" : "Run compliance scan"}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Open issues" value={String(open.length)} icon={ShieldAlert} />
        <StatCard title="High severity" value={String(high.length)} icon={ShieldAlert} />
        <StatCard title="Total logged" value={String(rows.length)} icon={CheckCircle2} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No issues"
          description="Run a compliance scan against templates, assets, and colors."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issue</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detected</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell>
                    <div className="font-medium text-sm">{String(r.title)}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {String(r.description || "")}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs capitalize">{String(r.issue_type).replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <Badge
                      variant={r.severity === "high" || r.severity === "critical" ? "destructive" : "outline"}
                      className="text-[10px] capitalize"
                    >
                      {String(r.severity)}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{String(r.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.created_at ? formatDate(String(r.created_at)) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => resolve(String(r.id))}>
                        Resolve
                      </Button>
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
