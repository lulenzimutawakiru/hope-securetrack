"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Library, Play, Search } from "lucide-react";
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
import { toast } from "sonner";

const CATEGORIES = [
  "all",
  "financial",
  "operational",
  "analytical",
  "executive",
  "exception",
  "comparative",
  "regulatory",
  "adhoc",
  "ai",
  "statistical",
];

export default function ReportLibraryPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [running, setRunning] = useState<string | null>(null);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("bi_report_definitions")
      .select("*")
      .is("deleted_at", null)
      .order("category")
      .order("name");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (cat !== "all" && String(r.category) !== cat) return false;
      if (!q) return true;
      const hay = `${r.report_code} ${r.name} ${r.description} ${r.module_key}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [rows, q, cat]);

  const runReport = async (r: Record<string, unknown>) => {
    if (!auth) return;
    setRunning(String(r.id));
    const supabase = createClient();
    const started = Date.now();
    // Resolve live row counts from known data sources when possible
    let rowCount = 0;
    const source = String(r.data_source ?? "");
    const known: Record<string, string> = {
      production_batches: "production_batches",
      verification_logs: "verification_logs",
      invoices: "invoices",
      employees: "employees",
      chart_of_accounts: "chart_of_accounts",
      bi_kpis: "bi_kpis",
    };
    if (known[source]) {
      const { count } = await supabase
        .from(known[source])
        .select("*", { count: "exact", head: true });
      rowCount = count ?? 0;
    }
    const { error } = await supabase.from("bi_report_runs").insert({
      company_id: auth.profile.company_id,
      report_id: r.id,
      report_code: r.report_code,
      run_by: auth.profile.id,
      status: "completed",
      row_count: rowCount,
      format: "interactive",
      duration_ms: Date.now() - started,
      completed_at: new Date().toISOString(),
    });
    setRunning(null);
    if (error) toast.error(error.message);
    else toast.success(`Ran ${String(r.name)} (${rowCount} rows)`);
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Report Library"
        description="Enterprise report catalog — financial · operational · regulatory · AI · ad-hoc"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/reports/designer">Designer</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search reports…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={cat === c ? "default" : "outline"}
              onClick={() => setCat(c)}
              className="capitalize"
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Library} title="No reports" description="Seed catalog or create in Designer" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Source</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.report_code)}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{String(r.name)}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {String(r.description ?? "")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {String(r.category)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {String(r.report_type)}
                  </TableCell>
                  <TableCell className="text-sm">{String(r.module_key ?? "—")}</TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground">
                    {String(r.data_source ?? "—")}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={running === String(r.id)}
                      onClick={() => runReport(r)}
                    >
                      <Play className="h-3.5 w-3.5 mr-1" />
                      Run
                    </Button>
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
