"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Shield, KeyRound, MonitorSmartphone, History } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import {
  forcePasswordReset,
  updateAccountStatus,
  terminateAllUserSessions,
  startOffboarding,
  completeOffboarding,
} from "@/lib/idm";

export default function UserIdentityProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { auth } = useUser();
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [roles, setRoles] = useState<Array<Record<string, unknown>>>([]);
  const [logins, setLogins] = useState<Array<Record<string, unknown>>>([]);
  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([]);
  const [activity, setActivity] = useState<Array<Record<string, unknown>>>([]);
  const [devices, setDevices] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [tempPw, setTempPw] = useState<string | null>(null);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data: u }, { data: ur }, { data: lh }, { data: ss }, { data: act }, { data: dev }] =
      await Promise.all([
        supabase.from("user_profiles").select("*, roles!user_profiles_role_id_fkey(name,slug)").eq("id", id).maybeSingle(),
        supabase.from("idm_user_roles").select("*, roles(name,slug)").eq("user_id", id),
        supabase.from("login_history").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
        supabase.from("user_sessions").select("*").eq("user_id", id).order("last_seen_at", { ascending: false }).limit(10),
        supabase.from("idm_user_activity").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(30),
        supabase.from("idm_devices").select("*").eq("user_id", id).order("last_activity_at", { ascending: false }).limit(20),
      ]);
    setUser(u as Record<string, unknown> | null);
    setRoles((ur as Array<Record<string, unknown>>) || []);
    setLogins((lh as Array<Record<string, unknown>>) || []);
    setSessions((ss as Array<Record<string, unknown>>) || []);
    setActivity((act as Array<Record<string, unknown>>) || []);
    setDevices((dev as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingState message="Loading user identity…" />;
  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">User not found.</p>
        <Button asChild className="mt-4"><Link href="/dashboard/identity/users">Back</Link></Button>
      </div>
    );
  }

  const role = user.roles as { name?: string; slug?: string } | null;

  return (
    <div>
      <PageHeader
        title={`${String(user.first_name)} ${String(user.last_name)}`}
        description={`${String(user.email)} · ${String(user.username || "no username")}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!companyId) return;
                try {
                  const res = await forcePasswordReset({
                    company_id: companyId,
                    user_id: id,
                    actor_id: auth?.user?.id,
                  });
                  setTempPw(res.temp_password);
                  toast.success("Password reset");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              <KeyRound className="h-4 w-4 mr-1" /> Reset password
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!companyId) return;
                await updateAccountStatus({
                  user_id: id,
                  company_id: companyId,
                  account_status: user.is_active ? "suspended" : "active",
                  actor_id: auth?.user?.id,
                });
                toast.success("Status updated");
                await load();
              }}
            >
              {user.is_active ? "Suspend" : "Activate"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!companyId) return;
                await terminateAllUserSessions({
                  user_id: id,
                  company_id: companyId,
                  actor_id: auth?.user?.id,
                });
                toast.success("All sessions ended");
                await load();
              }}
            >
              End sessions
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                if (!companyId || !confirm("Offboard this user (disable, revoke sessions/devices)?")) return;
                const job = await startOffboarding({
                  company_id: companyId,
                  user_id: id,
                  created_by: auth?.user?.id,
                });
                await completeOffboarding({
                  offboard_id: job.id,
                  company_id: companyId,
                  actor_id: auth?.user?.id,
                });
                toast.success("Offboarding completed");
                await load();
              }}
            >
              Offboard
            </Button>
            {user.employee_record_id ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/profiles/${String(user.employee_record_id)}`}>Employee 360°</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {tempPw && (
        <Card className="mb-4 border-amber-200">
          <CardContent className="pt-4 text-sm">
            Temp password: <code className="font-mono">{tempPw}</code>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Identity</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <Field label="Username" value={String(user.username || "—")} />
            <Field label="Employee ID" value={String(user.employee_id || "—")} />
            <Field label="User type" value={String(user.user_type || "employee")} />
            <Field label="Job title" value={String(user.job_title || "—")} />
            <Field label="Phone" value={String(user.phone || "—")} />
            <div className="flex gap-2 pt-1">
              <StatusBadge status={String(user.account_status || "active")} />
              <Badge variant="outline">{String(user.lifecycle_status || "active")}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Organization</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <Field label="Division" value={String(user.division || "—")} />
            <Field label="Team" value={String(user.team_name || "—")} />
            <Field label="Location" value={String(user.location_name || "—")} />
            <Field label="Cost center" value={String(user.cost_center || "—")} />
            <Field label="Data scope" value={String(user.data_scope || "company")} />
            <Field label="Provisioned from" value={String(user.provisioned_from || "manual")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Security
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <Field label="Primary role" value={role?.name || "—"} />
            <Field label="MFA enabled" value={user.mfa_enabled ? "Yes" : "No"} />
            <Field label="MFA required" value={user.require_mfa || user.mfa_enforced ? "Yes" : "No"} />
            <Field label="Must change password" value={user.must_change_password ? "Yes" : "No"} />
            <Field label="Failed logins" value={String(user.failed_login_count ?? 0)} />
            <Field label="Locked until" value={user.locked_until ? formatDateTime(String(user.locked_until)) : "—"} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Assigned roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {roles.length === 0 && (
              <p className="text-sm text-muted-foreground">Primary only: {role?.name || "—"}</p>
            )}
            {roles.map((r) => {
              const rr = r.roles as { name?: string; slug?: string } | null;
              return (
                <div key={String(r.id)} className="flex justify-between text-sm border-b py-1.5">
                  <span>{rr?.name || String(r.role_id).slice(0, 8)}</span>
                  {r.is_primary ? <Badge variant="outline" className="text-[10px]">Primary</Badge> : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4" /> Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tracked sessions.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {sessions.map((s) => (
                  <div key={String(s.id)} className="border-b pb-1.5">
                    <div className="flex justify-between">
                      <span>{String(s.device_label || s.user_agent || "Device").slice(0, 40)}</span>
                      <StatusBadge status={s.is_active ? "active" : "closed"} />
                    </div>
                    <div className="text-muted-foreground">
                      {s.last_seen_at ? formatDateTime(String(s.last_seen_at)) : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Devices ({devices.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {devices.length === 0 && <p className="text-sm text-muted-foreground">No devices.</p>}
            {devices.map((d) => (
              <div key={String(d.id)} className="flex justify-between text-sm border-b py-1">
                <span>{String(d.device_name)} · {String(d.device_type)}</span>
                <StatusBadge status={String(d.security_status || "trusted")} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Activity (approvals · docs · transactions)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {activity.length === 0 && <p className="text-sm text-muted-foreground">No activity recorded.</p>}
            {activity.map((a) => (
              <div key={String(a.id)} className="text-sm border-b py-1.5">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{String(a.title)}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{String(a.activity_type)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {String(a.module || "")} · {a.created_at ? formatDateTime(String(a.created_at)) : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Login history
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logins.map((l) => (
                  <TableRow key={String(l.id)}>
                    <TableCell className="text-xs">{l.created_at ? formatDateTime(String(l.created_at)) : "—"}</TableCell>
                    <TableCell>{l.success ? "OK" : String(l.failure_reason || "Failed")}</TableCell>
                    <TableCell className="font-mono text-xs">{String(l.ip_address || "—")}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{String(l.user_agent || "—")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium capitalize">{value}</div>
    </div>
  );
}
