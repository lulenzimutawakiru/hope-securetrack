"use client";

import { useEffect, useState } from "react";
import { Download, FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { downloadCsv, toCsv } from "@/lib/ppm";
import { toast } from "sonner";

const REPORTS = [
  { id: "projects", title: "Project Status", table: "ppm_projects", cols: ["project_code", "name", "status", "health", "percent_complete", "spi", "cpi", "budget_planned", "budget_actual"] },
  { id: "tasks", title: "Task Report", table: "ppm_tasks", cols: ["task_code", "name", "project_code", "assignee_name", "status", "due_date", "estimated_hours", "actual_hours"] },
  { id: "resources", title: "Resource Report", table: "ppm_resource_allocations", cols: ["allocation_code", "resource_name", "project_code", "allocation_pct", "hours_planned", "hours_actual", "status"] },
  { id: "budget", title: "Budget Report", table: "ppm_budgets", cols: ["budget_code", "project_code", "category", "planned_amount", "actual_amount", "forecast_amount"] },
  { id: "risks", title: "Risk Report", table: "ppm_risks", cols: ["risk_code", "title", "project_code", "probability", "impact", "risk_score", "status"] },
  { id: "issues", title: "Issue Report", table: "ppm_issues", cols: ["issue_code", "title", "project_code", "severity", "status", "owner_name"] },
  { id: "timesheets", title: "Timesheet Report", table: "ppm_timesheets", cols: ["timesheet_number", "project_code", "resource_name", "work_date", "hours", "status"] },
  { id: "invoices", title: "Billing Report", table: "ppm_invoices", cols: ["invoice_number", "project_code", "customer_name", "net_amount", "status", "invoice_date"] },
] as const;

export default function PpmReportsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      const sb = createClient();
      const next: Record<string, number> = {};
      await Promise.all(
        REPORTS.map(async (r) => {
          const { count } = await sb
            .from(r.table)
            .select("*", { count: "exact", head: true })
            .eq("company_id", companyId);
          next[r.id] = count ?? 0;
        })
      );
      setCounts(next);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [companyId]);

  const exportReport = async (r: (typeof REPORTS)[number]) => {
    if (!companyId) return;
    try {
      const { data, error } = await createClient()
        .from(r.table)
        .select("*")
        .eq("company_id", companyId)
        .limit(2000);
      if (error) throw error;
      const rows = (data || []) as Array<Record<string, unknown>>;
      downloadCsv(
        `ppm-${r.id}-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(rows, [...r.cols])
      );
      toast.success(`Exported ${rows.length} rows`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  if (loading) return <LoadingState message="Loading project reports…" />;

  return (
    <div>
      <PageHeader title="Project Reports" description="Status · resources · budget · risk · timesheets · billing · CSV export" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileBarChart className="h-4 w-4" /> {r.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{counts[r.id] ?? 0} records</span>
              <Button size="sm" variant="outline" onClick={() => exportReport(r)}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
