"use client";

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

export default function PlatformTenantDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [plan, setPlan] = useState("professional");
  const [trialDays, setTrialDays] = useState("30");
  const [suspendReason, setSuspendReason] = useState("");

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

  if (loading) return <LoadingState message="Loading tenant control panel…" />;
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
        description={`cPanel · ${detail.slug} · ${detail.primary_contact_email || "no contact"}`}
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
                {detail.plan_code || "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lifecycle */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lifecycle controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || detail.status === "active"}
              onClick={() => mutate("activate")}
            >
              <PlayCircle className="h-3.5 w-3.5 mr-1" /> Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || detail.status === "suspended"}
              onClick={() =>
                mutate("suspend", {
                  reason: suspendReason || "Suspended by platform admin",
                })
              }
            >
              <PauseCircle className="h-3.5 w-3.5 mr-1" /> Suspend
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                mutate("trial", { days: Number(trialDays) || 30 })
              }
            >
              <Timer className="h-3.5 w-3.5 mr-1" /> Extend trial
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Cancel this tenant? They will lose access until reactivated."
                  )
                ) {
                  mutate("cancel");
                }
              }}
            >
              Cancel tenant
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link href="/platform/ops">Offboarding / legal hold</Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Suspend reason</Label>
              <Input
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Optional note"
              />
            </div>
            <div>
              <Label>Trial days</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
              />
            </div>
            <div>
              <Label>Plan</Label>
              <div className="flex gap-2">
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
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => mutate("update_plan", { plan_code: plan })}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Locale: {detail.country_code || "—"} ·{" "}
            {detail.primary_currency || "—"} · {detail.timezone || "—"}
            {detail.trial_ends_at
              ? ` · Trial ends ${new Date(detail.trial_ends_at).toLocaleDateString()}`
              : ""}
          </p>
        </CardContent>
      </Card>

      {/* Setup progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Go-live setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {setupDone} of {setupTotal} steps
            </span>
            <span className="font-medium">{setupPct}%</span>
          </div>
          <Progress value={setupPct} />
          <ul className="grid gap-1 sm:grid-cols-2">
            {detail.setup.map((s) => {
              const done =
                s.status === "completed" || s.status === "skipped";
              return (
                <li
                  key={String(s.step_key)}
                  className="flex items-center gap-2 text-xs"
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>{String(s.step_label || s.step_key)}</span>
                  <Badge variant="outline" className="text-[9px] ml-auto">
                    {String(s.status)}
                  </Badge>
                </li>
              );
            })}
            {detail.setup.length === 0 && (
              <li className="text-xs text-muted-foreground">
                No setup wizard rows for this tenant.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Companies */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Companies
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                      {String(c.code)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.is_primary ? "Yes" : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Users */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Users
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {detail.admins.map((u) => {
              const role = u.roles as { name?: string; slug?: string } | null;
              return (
                <div
                  key={String(u.id)}
                  className="flex justify-between gap-2 text-sm border-b py-1.5 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {String(u.first_name || "")} {String(u.last_name || "")}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {String(u.email)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {role?.name || role?.slug || "—"}
                  </Badge>
                </div>
              );
            })}
            {detail.admins.length === 0 && (
              <p className="text-xs text-muted-foreground">No users found.</p>
            )}
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
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {detail.modules.map((m) => (
              <div
                key={String(m.id || m.module_code)}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
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
            {detail.modules.length === 0 && (
              <p className="text-xs text-muted-foreground col-span-full">
                No module rows — provision or seed modules for this tenant.
              </p>
            )}
          </div>
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
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {detail.flags.map((f) => (
              <div
                key={String(f.id || f.flag_key)}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs truncate mr-2">
                  {String(f.flag_key)}
                </span>
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
            {detail.flags.length === 0 && (
              <p className="text-xs text-muted-foreground col-span-full">
                No tenant flags yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Events */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Recent events
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 max-h-60 overflow-y-auto">
          {detail.recent_events.map((ev) => (
            <div
              key={String(ev.id)}
              className="flex justify-between gap-2 text-xs border-b py-1.5 last:border-0"
            >
              <span className="font-medium truncate">
                {String(ev.event_type)}
              </span>
              <span className="text-muted-foreground shrink-0">
                {ev.created_at
                  ? new Date(String(ev.created_at)).toLocaleString()
                  : ""}
              </span>
            </div>
          ))}
          {detail.recent_events.length === 0 && (
            <p className="text-xs text-muted-foreground">No events yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
