"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { VerificationLog } from "@/types/database";

export default function VerificationPage() {
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    total: 0,
    genuine: 0,
    counterfeit: 0,
    today: 0,
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);

      const [{ data }, total, genuine, counterfeit, todayCount] = await Promise.all([
        supabase
          .from("verification_logs")
          .select("*")
          .order("verified_at", { ascending: false })
          .limit(200),
        supabase.from("verification_logs").select("*", { count: "exact", head: true }),
        supabase
          .from("verification_logs")
          .select("*", { count: "exact", head: true })
          .eq("result", "genuine"),
        supabase
          .from("verification_logs")
          .select("*", { count: "exact", head: true })
          .eq("result", "counterfeit"),
        supabase
          .from("verification_logs")
          .select("*", { count: "exact", head: true })
          .gte("verified_at", `${today}T00:00:00`),
      ]);

      setLogs((data as VerificationLog[]) ?? []);
      setCounts({
        total: total.count ?? 0,
        genuine: genuine.count ?? 0,
        counterfeit: counterfeit.count ?? 0,
        today: todayCount.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Verification Logs"
        description="Public and internal product authenticity checks"
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard title="Total Scans" value={formatNumber(counts.total)} icon={ShieldCheck} />
        <StatCard title="Today" value={formatNumber(counts.today)} />
        <StatCard title="Genuine" value={formatNumber(counts.genuine)} />
        <StatCard title="Counterfeit" value={formatNumber(counts.counterfeit)} />
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No verification logs"
          description="Scans from the public verify page will appear here"
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UUID</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>First Scan</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">
                    {l.public_uuid?.slice(0, 13) ?? "—"}…
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={l.result} />
                  </TableCell>
                  <TableCell className="capitalize">{l.scan_source ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {[l.city, l.country].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell>{l.is_first_scan ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(l.verified_at)}
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
