"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cog, RefreshCw, Check, X, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import {
  listProvisionJobs,
  getProvisionJob,
  runProvisionJob,
  getDigitalIdentityStats,
} from "@/lib/digital-identity";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function ProvisionEnginePage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    job: Record<string, unknown>;
    checklist: Array<Record<string, unknown>>;
  } | null>(null);
  const [stats, setStats] = useState({ openJobs: 0, provisionJobs: 0 });
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const [j, s] = await Promise.all([
        listProvisionJobs({ status: filter, limit: 100 }),
        getDigitalIdentityStats(),
      ]);
      setJobs(j as Array<Record<string, unknown>>);
      setStats({ openJobs: s.openJobs, provisionJobs: s.provisionJobs });
    } catch {
      /* pending */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [filter]);

  const openDetail = async (id: string) => {
    setSelected(id);
    try {
      const d = await getProvisionJob(id);
      if (d) setDetail(d as typeof detail);
    } catch {
      setDetail(null);
    }
  };

  const rerun = async (id: string) => {
    setBusy(id);
    try {
      await runProvisionJob(id);
      toast.success("Job re-run complete");
      await load();
      await openDetail(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <LoadingState message="Loading provision engine…" />;

  const statusIcon = (s: string) => {
    if (s === "done") return <Check className="h-3.5 w-3.5 text-emerald-600" />;
    if (s === "failed") return <X className="h-3.5 w-3.5 text-red-600" />;
    return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  };

  return (
    <div>
      <PageHeader
        title="Enterprise Provision Engine"
        description="Create · assign roles · email · SecureChat · MFA · activate · deprovision"
        actions={
          <div className="flex gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild size="sm">
              <Link href="/dashboard/identity/hire">New hire</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Total jobs" value={String(stats.provisionJobs)} icon={Cog} />
        <StatCard title="Open / running" value={String(stats.openJobs)} icon={Clock} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {jobs.length === 0 ? (
            <EmptyState title="No provision jobs" description="Run a hire orchestration to create jobs." />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow
                      key={j.id as string}
                      className={selected === j.id ? "bg-muted/50" : "cursor-pointer"}
                      onClick={() => openDetail(j.id as string)}
                    >
                      <TableCell className="font-mono text-xs">{String(j.job_number)}</TableCell>
                      <TableCell className="font-medium text-sm">{String(j.display_name || "—")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{String(j.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{String(j.trigger_source)}</TableCell>
                      <TableCell className="text-xs">{formatDate(String(j.created_at))}</TableCell>
                      <TableCell>
                        {(j.status === "failed" || j.status === "partial" || j.status === "queued") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy === j.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              rerun(j.id as string);
                            }}
                          >
                            Re-run
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

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Checklist detail</CardTitle>
          </CardHeader>
          <CardContent>
            {!detail ? (
              <p className="text-sm text-muted-foreground">Select a job to view steps.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-mono text-muted-foreground">{String(detail.job.job_number)}</p>
                {detail.job.person_id != null && String(detail.job.person_id) !== "" && (
                  <Link
                    href={`/dashboard/identity/persons/${String(detail.job.person_id)}`}
                    className="text-xs text-hope-navy hover:underline"
                  >
                    Open person
                  </Link>
                )}
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                  {detail.checklist.map((c) => (
                    <div
                      key={c.id as string}
                      className="flex items-start gap-2 rounded border px-2 py-1.5 text-xs"
                    >
                      {statusIcon(String(c.status))}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{String(c.step_label)}</p>
                        <p className="text-muted-foreground">
                          {String(c.module_code)} · {String(c.status)}
                          {c.entity_code ? ` · ${String(c.entity_code)}` : ""}
                        </p>
                        {c.error_message != null && String(c.error_message) !== "" && (
                          <p className="text-red-600">{String(c.error_message)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
