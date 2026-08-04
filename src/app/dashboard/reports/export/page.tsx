"use client";

import { useState } from "react";
import Link from "next/link";
import { FileOutput, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { downloadCsv } from "@/lib/documents";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

const EXTRACTS = [
  { key: "kpis", label: "KPI register", table: "bi_kpis", cols: ["kpi_code", "name", "category", "target_value", "actual_value", "variance_pct", "trend", "owner_name"] },
  { key: "reports", label: "Report catalog", table: "bi_report_definitions", cols: ["report_code", "name", "category", "report_type", "module_key", "data_source"] },
  { key: "insights", label: "AI insights", table: "bi_ai_insights", cols: ["insight_type", "domain", "title", "severity", "confidence", "status", "horizon"] },
  { key: "schedules", label: "Schedules", table: "bi_report_schedules", cols: ["schedule_code", "name", "frequency_label", "format", "is_active"] },
  { key: "regulatory", label: "Regulatory packages", table: "bi_regulatory_packages", cols: ["package_code", "name", "authority", "filing_frequency", "due_day"] },
  { key: "documents", label: "Document jobs", table: "bi_document_jobs", cols: ["document_type", "title", "reference_number", "status", "format"] },
];

export default function ExportCenterPage() {
  const { auth } = useUser();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (extract: (typeof EXTRACTS)[0]) => {
    if (!auth) return;
    setBusy(extract.key);
    const supabase = createClient();
    const { data, error } = await supabase
      .from(extract.table)
      .select("*")
      .limit(2000);
    if (error) {
      toast.error(error.message);
      setBusy(null);
      return;
    }
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    downloadCsv(
      `${extract.key}-${new Date().toISOString().slice(0, 10)}.csv`,
      extract.cols,
      rows.map((r) => extract.cols.map((c) => (r[c] == null ? "" : String(r[c]))))
    );
    const crudRes = await crudCreate("bi_report_runs", {
      company_id: auth.profile.company_id,
      report_code: `EXPORT-${extract.key.toUpperCase()}`,
      run_by: auth.profile.id,
      status: "completed",
      row_count: rows.length,
      format: "csv",
      completed_at: new Date().toISOString(),
    });
    toast.success(`Exported ${rows.length} rows`);
    setBusy(null);
  };

  return (
    <div>
      <PageHeader
        title="Export Center"
        description="Bulk CSV extracts · PDF/Excel packs via print & library runs · audit logged"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/reports">Hub</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EXTRACTS.map((ex) => (
          <Card key={ex.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileOutput className="h-4 w-4 text-hope-teal" />
                {ex.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3 font-mono">{ex.table}</p>
              <Button
                size="sm"
                disabled={busy === ex.key}
                onClick={() => run(ex)}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                {busy === ex.key ? "Exporting…" : "Export CSV"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
