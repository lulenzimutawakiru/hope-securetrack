"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Circle, Copy,
  Loader2, RefreshCw, XCircle,
} from "lucide-react";
import type {
  ProvisioningJobEvent,
  ProvisioningJobRow,
  ProvisioningRunResult,
  ProvisioningStepRow,
} from "@/lib/platform/provisioning/types";
import { formatDateTime } from "@/lib/utils";

function jobStatusVariant(status: string) {
  if (status === "completed") return "success" as const;
  if (status === "failed") return "destructive" as const;
  if (status === "running" || status === "partial") return "default" as const;
  if (status === "pending" || status === "queued") return "warning" as const;
  return "outline" as const;
}

function stepStatusVariant(status: string) {
  if (status === "completed") return "success" as const;
  if (status === "failed") return "destructive" as const;
  if (status === "running") return "default" as const;
  if (status === "skipped") return "outline" as const;
  return "warning" as const;
}

function fmtMs(ms: number | null | undefined) {
  if (ms == null) return "-";
  if (ms < 1000) return ms + " ms";
  return (ms / 1000).toFixed(1) + " s";
}

function StepIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-600" />;
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-hope-teal" />;
  if (status === "skipped") return <Circle className="h-4 w-4 text-muted-foreground/50" />;
  return <Circle className="h-4 w-4 text-muted-foreground/60" />;
}

function EventIcon({ severity }: { severity?: string }) {
  if (severity === "error") return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />;
  if (severity === "warning") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />;
  return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />;
}

function SecretRow({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed - select the value manually");
    }
  };
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <Button size="sm" variant="ghost" onClick={() => void copy()}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      <code className="block truncate font-mono text-xs">{value}</code>
    </div>
  );
}

export default function ProvisioningJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [job, setJob] = useState<ProvisioningJobRow | null>(null);
  const [steps, setSteps] = useState<ProvisioningStepRow[]>([]);
  const [events, setEvents] = useState<ProvisioningJobEvent[]>([]);
  const [retryOpen, setRetryOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [result, setResult] = useState<ProvisioningRunResult | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch("/api/platform/provisioning/" + encodeURIComponent(String(id)));
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        if (res.status === 404) setNotFound(true);
        toast.error(json?.error?.message || "Failed to load provisioning job");
        return;
      }
      setJob(json.data?.job || null);
      setSteps(Array.isArray(json.data?.steps) ? json.data.steps : []);
      setEvents(Array.isArray(json.data?.events) ? json.data.events : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load provisioning job");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const doRetry = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      const res = await fetch("/api/platform/provisioning/" + encodeURIComponent(String(id)), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adminPassword.trim() ? { adminPassword: adminPassword.trim() } : {}),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        toast.error(json?.error?.message || "Retry failed");
        return;
      }
      setResult(json.data || null);
      setRetryOpen(false);
      setAdminPassword("");
      toast.success("Provisioning retried - refreshing state");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading provisioning job?" />;
  }

  if (notFound || !job) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Provisioning job"
          description="Job detail"
          actions={<Button size="sm" variant="outline" asChild><Link href="/platform/provisioning"><ArrowLeft className="h-4 w-4 mr-1" /> Back to console</Link></Button>}
        />
        <EmptyState
          icon={XCircle}
          title="Provisioning job not found"
          description="The job may have been purged or the id is invalid."
        />
      </div>
    );
  }

  const doneSteps = steps.filter((s) => s.status === "completed").length;
  const progressPct = steps.length > 0 ? Math.round((doneSteps / steps.length) * 100) : 0;
  const output = (job.output_json || job.result_json || {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.organization_name || "Provisioning job"}
        description={(job.job_code ? job.job_code + " ? " : "") + "Tenant provisioning orchestration"}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild><Link href="/platform/provisioning"><ArrowLeft className="h-4 w-4 mr-1" /> Console</Link></Button>
            <Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
            <Button size="sm" variant="default" disabled={job.status === "running"} onClick={() => setRetryOpen(true)}><RefreshCw className="h-4 w-4 mr-1" /> Retry</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <JobFact label="Status"><Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge></JobFact>
        <JobFact label="Tenant number">{job.tenant_number || "-"}</JobFact>
        <JobFact label="Plan">{job.plan_code || "-"}</JobFact>
        <JobFact label="Attempt">{String(job.attempt || 1) + " / " + String(job.max_attempts || 3)}</JobFact>
        <JobFact label="Phase">{job.phase || "-"}</JobFact>
        <JobFact label="Duration">{fmtMs(job.duration_ms)}</JobFact>
      </div>

      {job.error_message && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div><div className="font-medium">Provisioning failed</div><div className="font-mono text-xs">{job.error_message}</div></div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Provisioning steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Progress value={progressPct} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground">{doneSteps} / {steps.length} complete</span>
              </div>
              {steps.length === 0 && (<p className="text-sm text-muted-foreground">No steps recorded yet.</p>)}
              <ol className="space-y-1">
                {steps.map((s, i) => (
                  <li key={s.id || s.step_key} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-xs font-medium text-muted-foreground w-5">{i + 1}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <StepIcon status={s.status} />
                            <span className="text-sm font-medium">{s.step_label}</span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span>{s.group_key}</span>
                            {s.attempt > 0 && <span>attempt {s.attempt}</span>}
                            <span>{s.duration_ms != null ? fmtMs(s.duration_ms) : "-"}</span>
                          </div>
                          {s.detail && <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>}
                          {s.error_message && <p className="mt-1 font-mono text-xs text-red-700">{s.error_message}</p>}
                        </div>
                      </div>
                      <Badge variant={stepStatusVariant(s.status)} className="shrink-0 text-[10px]">{s.status}</Badge>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 && (<p className="text-sm text-muted-foreground">No events recorded.</p>)}
              <ul className="space-y-2">
                {events.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-2 text-sm">
                    <EventIcon severity={ev.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{ev.event_type}</span>
                        {ev.phase && <Badge variant="outline" className="text-[9px]">{ev.phase}</Badge>}
                      </div>
                      <p className="text-xs">{ev.message || "-"}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{ev.created_at ? formatDateTime(ev.created_at) : "-"}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <JobFact label="Job code">{job.job_code}</JobFact>
              <JobFact label="Organization">{job.organization_name}</JobFact>
              <JobFact label="Administrator">{job.admin_email}</JobFact>
              <JobFact label="Country">{job.country_code || "-"}</JobFact>
              <JobFact label="Currency">{job.currency || "-"}</JobFact>
              <JobFact label="Template">{job.template_code || "-"}</JobFact>
              <JobFact label="Kind">{job.kind || "-"}</JobFact>
              <JobFact label="Provisioning mode">{job.provisioning_mode || "orchestrator"}</JobFact>
              <JobFact label="Created">{job.created_at ? formatDateTime(job.created_at) : "-"}</JobFact>
              <JobFact label="Started">{job.started_at ? formatDateTime(job.started_at) : "-"}</JobFact>
              <JobFact label="Completed">{job.completed_at ? formatDateTime(job.completed_at) : "-"}</JobFact>
              {job.correlation_id && <JobFact label="Correlation id"><span className="font-mono text-xs">{job.correlation_id}</span></JobFact>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Outputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <JobFact label="Tenant id">{String(output.tenantId || job.tenant_id || "-")}</JobFact>
              <JobFact label="Company id">{String(output.companyId || job.company_id || "-")}</JobFact>
              <JobFact label="Slug">{String(output.slug || "-")}</JobFact>
              <JobFact label="Domain">{String(output.domain || "-")}</JobFact>
              <JobFact label="Admin user id">{String(output.adminUserId || "-")}</JobFact>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={retryOpen} onOpenChange={setRetryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retry provisioning job</DialogTitle>
            <DialogDescription>Resumes from the first incomplete step. Completed steps are preserved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="retry-password">Administrator password (optional)</Label>
            <Input id="retry-password" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Required if identity step has not completed" />
            <p className="text-xs text-muted-foreground">Minimum 10 characters when provided.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetryOpen(false)}>Cancel</Button>
            <Button onClick={() => void doRetry()} disabled={retrying}>{retrying ? "Retrying?" : "Retry job"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(result)} onOpenChange={(v) => { if (!v) setResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provisioning result</DialogTitle>
            <DialogDescription>{result?.job?.status === "completed" ? "The tenant environment is ready." : "The provisioning run finished with status " + (result?.job?.status || "unknown") + "."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {result?.secrets?.encryption_secret_b64 && (<SecretRow label="Encryption key (one-time)" value={result.secrets.encryption_secret_b64} />)}
            {result?.secrets?.api_key_secret && (<SecretRow label={"API key (one-time) ? " + (result.secrets.api_key_prefix || "")} value={result.secrets.api_key_secret} />)}
            {!result?.secrets?.encryption_secret_b64 && !result?.secrets?.api_key_secret && (<p className="text-sm text-muted-foreground">No one-time secrets remain - they were disclosed at creation and vaulted.</p>)}
          </div>
          <DialogFooter>
            <Button onClick={() => setResult(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JobFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs font-medium break-words">{children}</div>
    </div>
  );
}
