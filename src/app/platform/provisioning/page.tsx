"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";
import {
  Building2, Timer, CheckCircle2, XCircle, Database, HardDrive,
  ShieldCheck, BarChart3, RefreshCw, Plus, LayoutGrid, Boxes, Zap, Copy,
  KeyRound, Rocket, TrendingUp, Activity, ArrowRight, Layers, Cpu,
} from "lucide-react";
import type {
  ExecutiveSnapshot,
  ProvisioningJobRow,
  ProvisioningRunResult,
  ProvisioningTemplate,
} from "@/lib/platform/provisioning/types";

function statusVariant(status: string) {
  if (status === "completed") return "success" as const;
  if (status === "failed") return "destructive" as const;
  if (status === "running" || status === "partial") return "default" as const;
  if (status === "pending") return "warning" as const;
  return "outline" as const;
}

function fmtMs(ms: number | null | undefined) {
  if (ms == null) return "-";
  if (ms < 1000) return ms + " ms";
  return (ms / 1000).toFixed(1) + " s";
}

function templateModules(t: ProvisioningTemplate): string[] {
  const cfg = (t.config || {}) as Record<string, unknown>;
  return Array.isArray(cfg.modules) ? (cfg.modules as string[]) : [];
}

function templateWorkflows(t: ProvisioningTemplate): string[] {
  const cfg = (t.config || {}) as Record<string, unknown>;
  return Array.isArray(cfg.workflows) ? (cfg.workflows as string[]) : [];
}

function templateCompliance(t: ProvisioningTemplate): string[] {
  const cfg = (t.config || {}) as Record<string, unknown>;
  return Array.isArray(cfg.compliance) ? (cfg.compliance as string[]) : [];
}

export default function ProvisioningPage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<ProvisioningJobRow[]>([]);
  const [snap, setSnap] = useState<ExecutiveSnapshot | null>(null);
  const [templates, setTemplates] = useState<ProvisioningTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProvisioningRunResult | null>(null);
  const [form, setForm] = useState({
    organization_name: "",
    slug: "",
    admin_email: "",
    admin_name: "Administrator",
    admin_password: "",
    plan_code: "enterprise",
    country_code: "UG",
    currency: "UGX",
    timezone: "",
    language: "en",
    data_region: "",
    industry: "",
    template_code: "",
    industry_pack: "",
    demo_data: false,
    registration_channel: "platform_console",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [jobsRes, snapRes, templatesRes] = await Promise.all([
        fetch("/api/platform/provisioning?limit=100"),
        fetch("/api/platform/provisioning/executive"),
        fetch("/api/platform/provisioning/templates"),
      ]);
      const [jobsJson, snapJson, templatesJson] = await Promise.all([
        jobsRes.json(),
        snapRes.json(),
        templatesRes.json(),
      ]);
      setJobs(Array.isArray(jobsJson?.jobs) ? jobsJson.jobs : []);
      if (snapJson?.ok) setSnap(snapJson.data || null);
      setTemplates(
        Array.isArray(templatesJson?.templates)
          ? templatesJson.templates
          : []
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load provisioning data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const tenantTemplates = templates.filter((t) => t.kind === "tenant");
  const industryPacks = templates.filter((t) => t.kind === "industry");

  const applyTemplate = (t: ProvisioningTemplate) => {
    setForm((f) => ({
      ...f,
      template_code: t.template_code,
      plan_code: (t.plan_code as string) || f.plan_code,
      industry: (t.industry as string) || f.industry,
    }));
    setOpen(true);
  };

  const applyIndustryPack = (t: ProvisioningTemplate) => {
    setForm((f) => ({
      ...f,
      industry_pack: t.template_code,
      industry: (t.industry as string) || f.industry,
    }));
    setOpen(true);
  };

  const provision = async () => {
    if (!form.organization_name || !form.admin_email) {
      toast.error("Organization and admin email required");
      return;
    }
    if (!form.admin_password || form.admin_password.length < 10) {
      toast.error("Admin password (min 10 chars, upper, number, special) is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/platform/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || "Provisioning failed");
      }
      setResult(json.data);
      toast.success("Tenant provisioned: " + (json.data?.tenantNumber || json.data?.job?.job_code || "done"));
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Provisioning failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading provisioning platform…" />;
  }

  const completed = (snap?.provisioning_success || 0) + (snap?.provisioning_failed || 0);
  const completionPct = completed > 0
    ? Math.round(((snap?.provisioning_success || 0) / completed) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant provisioning platform"
        description="Executive control plane - provision, configure, secure, monitor and govern every customer organization"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Provision tenant
            </Button>
          </div>
        }
      />

      {/* Executive dashboard */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <StatCard title="Total tenants" value={snap?.tenants_total ?? 0} icon={Building2} description="Estate" />
        <StatCard title="Active" value={snap?.tenants_active ?? 0} icon={CheckCircle2} description="Live orgs" />
        <StatCard title="Trial" value={snap?.tenants_trial ?? 0} icon={Zap} description="Starter plans" />
        <StatCard title="Suspended" value={snap?.tenants_suspended ?? 0} icon={XCircle} description="Paused" />
        <StatCard title="Avg provision" value={fmtMs(snap?.avg_provisioning_ms)} icon={Timer} description={"P95 " + fmtMs(snap?.p95_provisioning_ms)} />
        <StatCard title="Growth 30d" value={snap?.growth_30d ?? 0} icon={TrendingUp} description="New tenants" />
        <StatCard title="Security score" value={(snap?.security_score ?? 0) + "%"} icon={ShieldCheck} description="Baseline posture" />
        <StatCard title="Compliance" value={(snap?.compliance_score ?? 0) + "%"} icon={ShieldCheck} description="Controls" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="Provisioning queue" value={snap?.provisioning_queue ?? 0} icon={Layers} description="Pending jobs" />
        <StatCard title="Running jobs" value={snap?.provisioning_running ?? 0} icon={Activity} description="In flight" />
        <StatCard title="Succeeded" value={snap?.provisioning_success ?? 0} icon={CheckCircle2} description="All time" />
        <StatCard title="Failed" value={snap?.provisioning_failed ?? 0} icon={XCircle} description="Needs attention" />
        <StatCard title="Storage" value={(snap?.storage?.usage_mb ?? 0) + " MB"} icon={HardDrive} description={(snap?.storage?.objects ?? 0) + " objects"} />
        <StatCard title="API 24h" value={snap?.api?.requests_24h ?? 0} icon={BarChart3} description={(snap?.api?.errors_24h ?? 0) + " errors"} />
        <StatCard title="AI agents" value={snap?.ai?.agents ?? 0} icon={Cpu} description="Industry models" />
        <StatCard title="Capacity" value={(snap?.capacity?.tenants_pct ?? 0) + "%"} icon={Database} description={(snap?.capacity?.tenants_limit ?? 0).toLocaleString() + " tenant limit"} />
      </div>

      {/* Infra strip */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Infrastructure health</span>
            <Badge variant={snap && snap.infra_health.down === 0 && snap.infra_health.degraded === 0 ? "success" : "warning"}>
              {snap && snap.infra_health.down === 0 && snap.infra_health.degraded === 0 ? "Healthy" : "Degraded"}
            </Badge>
          </div>
          <Progress value={snap ? ((snap.infra_health.healthy / Math.max(1, snap.infra_health.total)) * 100) : 0} />
          <p className="mt-2 text-xs text-muted-foreground">
            {snap?.infra_health?.healthy ?? 0} healthy · {snap?.infra_health?.degraded ?? 0} degraded · {snap?.infra_health?.down ?? 0} down
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Backup posture</span>
            <Badge variant={snap && snap.backup_status.stale === 0 ? "success" : "warning"}>
              {snap && snap.backup_status.stale === 0 ? "Protected" : "Review"}
            </Badge>
          </div>
          <Progress value={snap ? ((snap.backup_status.healthy / Math.max(1, snap.backup_status.total)) * 100) : 0} />
          <p className="mt-2 text-xs text-muted-foreground">
            {snap?.backup_status?.healthy ?? 0} healthy · {snap?.backup_status?.stale ?? 0} stale of {snap?.backup_status?.total ?? 0}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Provisioning success</span>
            <span className="font-semibold">{completionPct}%</span>
          </div>
          <Progress value={completionPct} />
          <p className="mt-2 text-xs text-muted-foreground">
            {snap?.provisioning_success ?? 0} completed · {snap?.provisioning_failed ?? 0} failed · {snap?.provisioning_queue ?? 0} queued
          </p>
        </div>
      </div>

      {/* Template catalog */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Provisioning templates</h3>
          </div>
          <span className="text-xs text-muted-foreground">{templates.length} metadata-driven templates</span>
        </div>
        <Tabs defaultValue="tenant">
          <TabsList className="m-4">
            <TabsTrigger value="tenant">Tenant templates ({tenantTemplates.length})</TabsTrigger>
            <TabsTrigger value="industry">Industry packs ({industryPacks.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="tenant" className="px-4 pb-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tenantTemplates.map((t) => (
                <TemplateCard
                  key={t.template_code}
                  template={t}
                  onInstall={() => applyTemplate(t)}
                  installLabel="Use template"
                />
              ))}
              {tenantTemplates.length === 0 && (
                <EmptyState icon={LayoutGrid} title="No tenant templates" description="Templates are seeded by the provisioning platform migration." />
              )}
            </div>
          </TabsContent>
          <TabsContent value="industry" className="px-4 pb-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {industryPacks.map((t) => (
                <TemplateCard
                  key={t.template_code}
                  template={t}
                  onInstall={() => applyIndustryPack(t)}
                  installLabel="Install pack"
                />
              ))}
              {industryPacks.length === 0 && (
                <EmptyState icon={Boxes} title="No industry packs" description="Industry accelerators are seeded by the provisioning platform migration." />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Jobs */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Provisioning jobs</h3>
          </div>
          <span className="text-xs text-muted-foreground">{jobs.length} recent</span>
        </div>
        {jobs.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="No provisioning jobs yet"
            description="Provision a new SaaS tenant or install an industry pack to get started."
            className="m-4"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-mono text-xs">{j.job_code}</TableCell>
                  <TableCell className="font-medium">{j.organization_name}</TableCell>
                  <TableCell className="text-xs">{j.admin_email}</TableCell>
                  <TableCell className="text-xs">{j.plan_code || "-"}</TableCell>
                  <TableCell className="text-xs">{j.template_code || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(j.status)} className="text-[10px]">{j.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtMs(j.duration_ms)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {j.created_at ? new Date(j.created_at).toLocaleString() : ""}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={"/platform/provisioning/jobs/" + j.id}>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Provision dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Provision a new tenant</DialogTitle>
            <DialogDescription>
              Creates an isolated enterprise environment: crypto vault, RLS, company, branch, subscription, modules, security baseline, admin identity, welcome portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Organization</Label>
                <Input
                  value={form.organization_name}
                  onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                  placeholder="Acme Manufacturing Ltd"
                />
              </div>
              <div>
                <Label>Admin email</Label>
                <Input
                  type="email"
                  value={form.admin_email}
                  onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                />
              </div>
              <div>
                <Label>Admin name</Label>
                <Input
                  value={form.admin_name}
                  onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Admin password</Label>
                <Input
                  type="password"
                  required
                  minLength={10}
                  value={form.admin_password}
                  onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                  placeholder="Min 10 chars · upper · number · special"
                />
              </div>
              <div>
                <Label>Plan</Label>
                <Select value={form.plan_code} onValueChange={(v) => setForm({ ...form, plan_code: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Country</Label>
                <Input
                  value={form.country_code}
                  onChange={(e) => setForm({ ...form, country_code: e.target.value })}
                  placeholder="UG"
                  maxLength={5}
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  placeholder="UGX"
                  maxLength={10}
                />
              </div>
              <div>
                <Label>Language</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="sw">Swahili</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tenant template</Label>
                <Select
                  value={form.template_code}
                  onValueChange={(v) => setForm({ ...form, template_code: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Auto by plan" /></SelectTrigger>
                  <SelectContent>
                    {tenantTemplates.map((t) => (
                      <SelectItem key={t.template_code} value={t.template_code}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Industry pack</Label>
                <Select
                  value={form.industry_pack}
                  onValueChange={(v) => setForm({ ...form, industry_pack: v })}
                >
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {industryPacks.map((t) => (
                      <SelectItem key={t.template_code} value={t.template_code}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Industry</Label>
                <Input
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  placeholder="manufacturing"
                />
              </div>
              <div>
                <Label>Data region</Label>
                <Input
                  value={form.data_region}
                  onChange={(e) => setForm({ ...form, data_region: e.target.value })}
                  placeholder="eu-west-1"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.demo_data}
                onChange={(e) => setForm({ ...form, demo_data: e.target.checked })}
              />
              Seed demo data (optional)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void provision()} disabled={busy}>
              {busy ? "Provisioning…" : "Provision tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time secrets disclosure */}
      <Dialog open={Boolean(result)} onOpenChange={(v) => { if (!v) setResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tenant provisioned</DialogTitle>
            <DialogDescription>
              {result?.tenantNumber ? "Tenant " + result.tenantNumber : "Environment"} is ready.
              {result?.domain ? " Sign in at " + result.domain + "." : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {result?.secrets?.encryption_secret_b64 && (
              <SecretRow label="Encryption key (one-time)" value={result.secrets.encryption_secret_b64} />
            )}
            {result?.secrets?.api_key_secret && (
              <SecretRow
                label={"API key (one-time) · " + (result.secrets.api_key_prefix || "")}
                value={result.secrets.api_key_secret}
              />
            )}
            {!result?.secrets?.encryption_secret_b64 && !result?.secrets?.api_key_secret && (
              <p className="text-sm text-muted-foreground">
                No one-time secrets remain - they were disclosed at creation and vaulted.
              </p>
            )}
            {result?.job?.id && (
              <Button
                variant="outline"
                className="w-full"
                asChild
              >
                <a href={"/platform/provisioning/jobs/" + result.job.id}>Open job details</a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateCard({
  template,
  onInstall,
  installLabel,
}: {
  template: ProvisioningTemplate;
  onInstall: () => void;
  installLabel: string;
}) {
  const modules = templateModules(template);
  const workflows = templateWorkflows(template);
  const compliance = templateCompliance(template);
  return (
    <div className="flex flex-col rounded-lg border p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={template.kind === "industry" ? "success" : "secondary"} className="text-[10px]">
              {template.kind === "industry" ? "industry" : "tenant"}
            </Badge>
            {template.plan_code && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{template.plan_code}</span>
            )}
          </div>
          <h4 className="mt-1 font-semibold">{template.name}</h4>
        </div>
        {template.industry && (
          <Badge variant="outline" className="text-[10px]">{template.industry}</Badge>
        )}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{template.description}</p>
      <div className="mb-3 space-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <LayoutGrid className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{modules.length}</span> modules
          <span className="text-muted-foreground">·</span>
          <span className="font-medium">{workflows.length}</span> workflows
        </div>
        {compliance.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {compliance.slice(0, 4).map((c) => (
              <Badge key={c} variant="outline" className="text-[9px]">{c}</Badge>
            ))}
          </div>
        )}
      </div>
      <div className="mt-auto">
        <Button size="sm" variant="outline" className="w-full" onClick={onInstall}>
          <Zap className="h-3.5 w-3.5 mr-1" /> {installLabel}
        </Button>
      </div>
    </div>
  );
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
      <div className="flex items-center gap-2">
        <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <code className="min-w-0 flex-1 truncate font-mono text-xs">{value}</code>
      </div>
    </div>
  );
}
