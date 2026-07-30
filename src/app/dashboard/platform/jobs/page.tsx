"use client";

import { useEffect, useState } from "react";
import { Server, RefreshCw, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

type JobRow = {
  id: string;
  job_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error?: string | null;
  run_after?: string;
  created_at?: string;
};

export default function PlatformJobsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [dlq, setDlq] = useState<Array<Record<string, unknown>>>([]);

  const load = async () => {
    const companyId = auth?.profile?.company_id;
    try {
      const sb = createClient();
      let jq = sb
        .from("job_queue")
        .select(
          "id,job_type,status,attempts,max_attempts,last_error,run_after,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (companyId) jq = jq.or(`company_id.eq.${companyId},company_id.is.null`);
      const [{ data: j }, { data: d }] = await Promise.all([
        jq,
        sb
          .from("job_dead_letters")
          .select("id,job_type,attempts,last_error,failed_at")
          .order("failed_at", { ascending: false })
          .limit(20),
      ]);
      setJobs((j as JobRow[]) || []);
      setDlq(d || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed (apply migration 00069)");
      setJobs([]);
      setDlq([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [auth?.profile?.company_id]);

  if (loading) return <LoadingState message="Loading job queue…" />;

  const pending = jobs.filter((j) => j.status === "pending").length;
  const dead = dlq.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Background Jobs"
        description="Durable queue · retries · dead-letter · worker /api/jobs/worker"
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setLoading(true);
                void load();
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="h-4 w-4" /> Pending / recent
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{jobs.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{pending}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Dead letters</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{dead}</CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-4 text-sm text-muted-foreground flex items-start gap-2">
          <Play className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            Process jobs with{" "}
            <code className="text-xs bg-muted px-1 rounded">
              POST /api/jobs/worker
            </code>{" "}
            and header{" "}
            <code className="text-xs bg-muted px-1 rounded">x-job-secret</code>{" "}
            = <code className="text-xs">JOB_WORKER_SECRET</code>. Schedule via
            cron or platform worker every minute.
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-semibold mb-2">Queue</h3>
        {jobs.length === 0 ? (
          <EmptyState
            title="No jobs"
            description="Jobs appear when payroll, notifications, or webhooks enqueue work."
          />
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">{j.job_type}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{j.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {j.attempts}/{j.max_attempts}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {j.last_error || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {j.created_at
                        ? new Date(j.created_at).toLocaleString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {dlq.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Dead letters</h3>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dlq.map((d) => (
                  <TableRow key={String(d.id)}>
                    <TableCell className="font-mono text-xs">
                      {String(d.job_type)}
                    </TableCell>
                    <TableCell>{String(d.attempts)}</TableCell>
                    <TableCell className="text-xs max-w-[240px] truncate">
                      {String(d.last_error || "—")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.failed_at
                        ? new Date(String(d.failed_at)).toLocaleString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
