"use client";

/**
 * Tenant control panel — full CRUD for a single organization.
 * Platform staff only (enforced by layout + API).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Users,
  Layers,
  Flag,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  Timer,
  CreditCard,
  Activity,
  CheckCircle2,
  Circle,
  Shield,
  Globe,
  KeyRound,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getPlanEntitlements } from "@/lib/platform/control-plane-registry";

type Detail = {
  id: string;
  slug: string;
  name: string;
  legal_name?: string | null;
  status: string;
  plan_code?: string | null;
  country_code?: string | null;
  primary_currency?: string | null;
  timezone?: string | null;
  primary_contact_email?: string | null;
  trial_ends_at?: string | null;
  created_at?: string | null;
  settings?: Record<string, unknown> | null;
  company_count?: number;
  user_count?: number;
  companies: Array<Record<string, unknown>>;
  subscription: Record<string, unknown> | null;
  modules: Array<Record<string, unknown>>;
  flags: Array<Record<string, unknown>>;
  admins: Array<Record<string, unknown>>;
  setup: Array<Record<string, unknown>>;
  recent_events: Array<Record<string, unknown>>;
  provisioning_jobs: Array<Record<string, unknown>>;
};

function dash(v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

export default function PlatformTenantDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [plan, setPlan] = useState("professional");
  const [trialDays, setTrialDays] = useState("30");
  const [suspendReason, setSuspendReason] = useState("");
  const [edit, setEdit] = useState({
    name: "",
    legal_name: "",
    primary_contact_email: "",
    country_code: "",
    primary_currency: "",
    timezone: "",
    industry: "",
    language: "",
    data_region: "",
    domain: "",
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/tenants/${id}`);
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Failed to load tenant");
      }
      const d = (json.data ?? json) as Detail;
      setDetail(d);
      setPlan(d.plan_code || "professional");
      const s = (d.settings || {}) as Record<string, unknown>;
      setEdit({
        name: d.name || "",
        legal_name: d.legal_name || "",
        primary_contact_email: d.primary_contact_email || "",
        country_code: d.country_code || "",
        primary_currency: d.primary_currency || "",
        timezone: d.timezone || "",
        industry: String(s.industry || ""),
        language: String(s.language || "en"),
        data_region: String(s.data_region || ""),
        domain: String(s.domain || ""),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = async (
    action: string,
    body: Record<string, unknown> = {}
  ) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Action failed");
      }
      toast.success(`OK: ${action}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: edit.name,
          legal_name: edit.legal_name || null,
          primary_contact_email: edit.primary_contact_email || null,
          country_code: edit.country_code || undefined,
          primary_currency: edit.primary_currency || undefined,
          timezone: edit.timezone || undefined,
          industry: edit.industry || null,
          language: edit.language || undefined,
          data_region: edit.data_region || undefined,
          domain: edit.domain || undefined,
          plan_code: plan as
            | "starter"
            | "professional"
            | "enterprise"
            | "government",
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Update failed");
      }
      toast.success("Tenant updated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const softDelete = async () => {
    if (
      !window.confirm(
        `Soft-delete "${detail?.name}"? Access is cancelled; record is retained.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/platform/tenants/${id}?reason=${encodeURIComponent("Deleted from tenant cPanel")}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Delete failed");
      }
      toast.success("Tenant soft-deleted");
      window.location.href = "/platform/tenants";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  };

  const hardDelete = async () => {
    const slug = window.prompt(
      `Hard delete permanently removes the tenant row.\nType the slug to confirm: ${detail?.slug}`
    );
    if (!slug || slug !== detail?.slug) {
      toast.error("Slug confirmation did not match");
      return;
    }
    setBusy(true);
    try {
      const qs = new URLSearchParams({
        hard: "1",
        force: "1",
        confirm_slug: slug,
        reason: "Hard delete from platform cPanel",
      });
      const res = await fetch(`/api/platform/tenants/${id}?${qs}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Hard delete failed");
      }
      toast.success("Tenant hard-deleted");
      window.location.href = "/platform/tenants";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hard delete failed");
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading tenant control panel..." />;
  }
  if (!detail) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/platform/tenants">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Tenant not found.</p>
      </div>
    );
  }

  const settings = (detail.settings || {}) as Record<string, unknown>;
  const isolation = (settings.isolation || {}) as Record<string, unknown>;
  const encryption = (settings.encryption || {}) as Record<string, unknown>;
  const compliance = (settings.compliance_requirements || []) as string[];
  const domain =
    String(settings.domain || "") || `${detail.slug}.securetrack.com`;
  const entitlements = getPlanEntitlements(detail.plan_code);

  const setupDone = detail.setup.filter(
    (s) => s.status === "completed" || s.status === "skipped"
  ).length;
  const setupTotal = detail.setup.length || 1;
  const setupPct = Math.round((setupDone / setupTotal) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/platform/tenants">
            <ArrowLeft className="h-4 w-4 mr-1" /> Tenants
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={load} disabled={busy}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      <PageHeader
        title={detail.name}
        description={`cPanel | ${detail.slug} | ${detail.primary_contact_email || "no contact"}`}
        actions={
          <Badge
            variant={
              detail.status === "active"
                ? "secondary"
                : detail.status === "suspended"
                  ? "destructive"
                  : "outline"
            }
            className="capitalize text-xs"
          >
            {detail.status}
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Companies</p>
              <p className="text-lg font-semibold">{detail.companies.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Users (sample)</p>
              <p className="text-lg font-semibold">{detail.admins.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Modules on</p>
              <p className="text-lg font-semibold">
                {detail.modules.filter((m) => m.enabled).length}/
                {detail.modules.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Plan</p>
              <p className="text-lg font-semibold capitalize">
                {dash(detail.plan_code)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Isolation + identity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Tenant isolation controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["tenant_id", isolation.enforce_tenant_id],
                ["company_id", isolation.enforce_company_id],
                ["branch_id", isolation.enforce_branch_id],
                ["RLS", isolation.rls],
                ["Storage", isolation.storage],
                ["Search", isolation.search],
                ["AI", isolation.ai],
                ["Reporting", isolation.reporting],
              ].map(([label, on]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between rounded border px-2 py-1.5"
                >
                  <span className="font-mono">{label}</span>
                  <Badge
                    variant={on !== false ? "secondary" : "destructive"}
                    className="text-[10px]"
                  >
                    {on !== false ? "enforced" : "off"}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Tenant ID:{" "}
              <span className="font-mono text-foreground">{detail.id}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Cross-tenant access is denied. Domain{" "}
              <span className="font-mono text-foreground">{domain}</span> cannot
              access other tenant namespaces.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Domain, crypto & compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-xs">
              <Globe className="h-3.5 w-3.5" />
              <span className="font-mono">{domain}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Encryption key ID:{" "}
              <span className="font-mono text-foreground">
                {dash(encryption.key_id)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Fingerprint:{" "}
              <span className="font-mono text-foreground break-all">
                {dash(encryption.fingerprint)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Algorithm: {dash(encryption.algorithm || "AES-256-GCM")}
            </p>
            <p className="text-xs text-muted-foreground">
              Industry: {dash(settings.industry)} | Language:{" "}
              {dash(settings.language)} | Region: {dash(settings.data_region)}
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              {compliance.length === 0 && (
                <Badge variant="outline" className="text-[10px]">
                  no compliance tags
                </Badge>
              )}
              {compliance.map((c) => (
                <Badge key={c} variant="secondary" className="text-[10px]">
                  {c}
                </Badge>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Raw encryption secret is vaulted at create time only — never
              re-exposed.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription entitlements */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Subscription entitlements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6 text-xs">
            <div className="rounded border p-2">
              <p className="text-muted-foreground">Users</p>
              <p className="font-semibold">{entitlements.max_users}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-muted-foreground">Storage (GB)</p>
              <p className="font-semibold">{entitlements.max_storage_gb}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-muted-foreground">API / day</p>
              <p className="font-semibold">
                {entitlements.max_api_calls_day.toLocaleString()}
              </p>
            </div>
            <div className="rounded border p-2">
              <p className="text-muted-foreground">AI tokens / mo</p>
              <p className="font-semibold">
                {entitlements.max_ai_tokens_month.toLocaleString()}
              </p>
            </div>
            <div className="rounded border p-2">
              <p className="text-muted-foreground">Reports / mo</p>
              <p className="font-semibold">{entitlements.max_reports_month}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-muted-foreground">Automations</p>
              <p className="font-semibold">{entitlements.max_automations}</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Seats on subscription:{" "}
            {dash(detail.subscription?.seats)} | Status:{" "}
            {dash(detail.subscription?.status)}
          </p>
        </CardContent>
      </Card>

      {/* Update tenant */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Update tenant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["name", "Organization name"],
                ["legal_name", "Legal name"],
                ["primary_contact_email", "Contact email"],
                ["country_code", "Country code"],
                ["primary_currency", "Currency"],
                ["timezone", "Timezone"],
                ["industry", "Industry"],
                ["language", "Language"],
                ["data_region", "Data region"],
                ["domain", "Tenant domain"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input
                  value={edit[key]}
                  onChange={(e) =>
                    setEdit({ ...edit, [key]: e.target.value })
                  }
                />
              </div>
            ))}
            <div>
              <Label>Plan</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Locale: {dash(detail.country_code)} |{" "}
            {dash(detail.primary_currency)} | {dash(detail.timezone)}
            {detail.trial_ends_at
              ? ` | Trial ends ${new Date(detail.trial_ends_at).toLocaleDateString()}`
              : ""}
          </p>
          <Button size="sm" disabled={busy} onClick={saveEdit}>
            Save changes
          </Button>
        </CardContent>
      </Card>

      {/* Lifecycle */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lifecycle and delete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || detail.status === "active"}
              onClick={() => mutate("activate")}
            >
              <PlayCircle className="h-4 w-4 mr-1" /> Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                mutate("suspend", {
                  reason: suspendReason || "Suspended by platform admin",
                })
              }
            >
              <PauseCircle className="h-4 w-4 mr-1" /> Suspend
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => mutate("cancel")}
            >
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Input
                className="w-20 h-8"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  mutate("trial", { days: Number(trialDays) || 30 })
                }
              >
                <Timer className="h-4 w-4 mr-1" /> Extend trial
              </Button>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => mutate("update_plan", { plan_code: plan })}
            >
              Apply plan only
            </Button>
          </div>
          <div>
            <Label>Suspend reason</Label>
            <Input
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Optional reason (audited)"
            />
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={softDelete}
            >
              Soft delete
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-destructive text-destructive"
              disabled={busy}
              onClick={hardDelete}
            >
              Hard delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Go-live setup */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Go-live setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Progress value={setupPct} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground">
              {setupDone}/{setupTotal} ({setupPct}%)
            </span>
          </div>
          <ul className="grid gap-1 sm:grid-cols-2 text-xs">
            {detail.setup.map((s) => (
              <li key={String(s.step_key)} className="flex items-center gap-2">
                {s.status === "completed" || s.status === "skipped" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span>{String(s.step_label || s.step_key)}</span>
                <Badge variant="outline" className="text-[9px] ml-auto">
                  {String(s.status)}
                </Badge>
              </li>
            ))}
            {detail.setup.length === 0 && (
              <li className="text-muted-foreground">No setup steps recorded.</li>
            )}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Companies */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Companies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Primary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.companies.map((c) => (
                  <TableRow key={String(c.id)}>
                    <TableCell className="text-sm">{String(c.name)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {dash(c.code)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.is_primary ? "Yes" : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {detail.companies.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground text-sm py-4"
                    >
                      No companies
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Admins */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Users / admins
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.admins.map((u) => {
                  const role = u.roles as
                    | { slug?: string; name?: string }
                    | null
                    | undefined;
                  return (
                    <TableRow key={String(u.id)}>
                      <TableCell className="text-xs">{String(u.email)}</TableCell>
                      <TableCell className="text-xs">
                        {role?.name || role?.slug || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {u.is_active === false ? "no" : "yes"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {detail.admins.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground text-sm py-4"
                    >
                      No users
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modules */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" /> Modules
          </CardTitle>
        </CardHeader>
        <CardContent>
          {detail.modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No module rows - provision or seed modules for this tenant.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {detail.modules.map((m) => (
                <div
                  key={String(m.module_code)}
                  className="flex items-center justify-between rounded border px-3 py-2"
                >
                  <span className="font-mono text-xs">
                    {String(m.module_code)}
                  </span>
                  <Switch
                    checked={Boolean(m.enabled)}
                    disabled={busy}
                    onCheckedChange={(enabled) =>
                      mutate("set_module", {
                        module_code: m.module_code,
                        enabled,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flags */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Flag className="h-4 w-4" /> Feature flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          {detail.flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flags for tenant.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {detail.flags.map((f) => (
                <div
                  key={String(f.flag_key)}
                  className="flex items-center justify-between rounded border px-3 py-2"
                >
                  <span className="font-mono text-xs">{String(f.flag_key)}</span>
                  <Switch
                    checked={Boolean(f.enabled)}
                    disabled={busy}
                    onCheckedChange={(enabled) =>
                      mutate("set_flag", {
                        flag_key: f.flag_key,
                        enabled,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Events + jobs */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Recent events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-64 overflow-y-auto">
            {detail.recent_events.map((e) => (
              <div
                key={String(e.id)}
                className="flex justify-between gap-2 border-b py-1.5 text-xs last:border-0"
              >
                <span className="font-mono truncate">{String(e.event_type)}</span>
                <span className="text-muted-foreground shrink-0">
                  {e.created_at
                    ? new Date(String(e.created_at)).toLocaleString()
                    : ""}
                </span>
              </div>
            ))}
            {detail.recent_events.length === 0 && (
              <p className="text-sm text-muted-foreground">No events</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Provisioning jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {detail.provisioning_jobs.map((j) => (
              <div
                key={String(j.id)}
                className="flex justify-between gap-2 border-b py-1.5 text-xs last:border-0"
              >
                <span className="font-mono">{String(j.job_code)}</span>
                <Badge variant="outline" className="text-[10px]">
                  {String(j.status)}
                </Badge>
              </div>
            ))}
            {detail.provisioning_jobs.length === 0 && (
              <p className="text-sm text-muted-foreground">No jobs</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
