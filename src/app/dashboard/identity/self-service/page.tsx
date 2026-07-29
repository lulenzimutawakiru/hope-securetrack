"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  UserCircle, KeyRound, Fingerprint, Smartphone, Shield, Plus,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { createAccessRequest, checkPassword } from "@/lib/idm";

export default function IdentitySelfServicePage() {
  const { auth } = useUser();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [devices, setDevices] = useState<Array<Record<string, unknown>>>([]);
  const [roles, setRoles] = useState<Array<Record<string, unknown>>>([]);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [availableRoles, setAvailableRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [reqOpen, setReqOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [reqForm, setReqForm] = useState({ title: "", description: "", request_type: "role", role_id: "" });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.user?.id;

  const load = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [{ data: p }, { data: d }, { data: ur }, { data: req }, { data: allRoles }] =
      await Promise.all([
        supabase.from("user_profiles").select("*, roles!user_profiles_role_id_fkey(name,slug)").eq("id", userId).maybeSingle(),
        supabase.from("idm_devices").select("*").eq("user_id", userId).order("last_activity_at", { ascending: false }),
        supabase.from("idm_user_roles").select("*, roles(name)").eq("user_id", userId),
        supabase.from("idm_access_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
        supabase.from("roles").select("id,name").eq("is_active", true).limit(50),
      ]);
    setProfile(p as Record<string, unknown> | null);
    setDevices((d as Array<Record<string, unknown>>) || []);
    setRoles((ur as Array<Record<string, unknown>>) || []);
    setRequests((req as Array<Record<string, unknown>>) || []);
    setAvailableRoles((allRoles as typeof availableRoles) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [userId]);

  const submitAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !userId) return;
    try {
      await createAccessRequest({
        company_id: companyId,
        user_id: userId,
        title: reqForm.title,
        description: reqForm.description,
        request_type: reqForm.request_type,
        requested_role_id: reqForm.role_id || null,
      });
      toast.success("Access request submitted");
      setReqOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    const check = checkPassword(pw.next);
    if (!check.valid) {
      toast.error(check.errors.join("; "));
      return;
    }
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw.next });
      if (error) throw error;
      await supabase
        .from("user_profiles")
        .update({
          must_change_password: false,
          temp_password_set: false,
          password_changed_at: new Date().toISOString(),
        })
        .eq("id", userId!);
      toast.success("Password updated");
      setPwOpen(false);
      setPw({ current: "", next: "", confirm: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password change failed");
    }
  };

  const enableMfaFlag = async () => {
    if (!userId) return;
    await createClient()
      .from("user_profiles")
      .update({ require_mfa: true, mfa_enforced: true })
      .eq("id", userId);
    toast.success("MFA required on your account");
    await load();
  };

  if (loading) return <LoadingState message="Loading self-service…" />;
  if (!profile) {
    return (
      <div className="p-8">
        <PageHeader title="My Account" description="Sign in to manage your identity settings." />
      </div>
    );
  }

  const role = profile.roles as { name?: string } | null;

  return (
    <div>
      <PageHeader
        title="User Self-Service"
        description="Profile · password · MFA · devices · permissions · access requests"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/profiles/me">Employee profile</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
              {String(profile.first_name || "?")[0]}
              {String(profile.last_name || "?")[0]}
            </div>
            <div>
              <div className="font-semibold">{String(profile.first_name)} {String(profile.last_name)}</div>
              <div className="text-xs text-muted-foreground">{String(profile.email)}</div>
              <div className="text-xs font-mono">{String(profile.username || "")}</div>
              <StatusBadge status={String(profile.account_status || "active")} className="mt-1" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Access</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Primary role: <strong>{role?.name || "—"}</strong></div>
            <div>MFA: {(profile.require_mfa || profile.mfa_enabled || profile.mfa_enforced) ? "Required / On" : "Optional"}</div>
            <div>Type: <span className="capitalize">{String(profile.user_type || "employee")}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Dialog open={pwOpen} onOpenChange={setPwOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><KeyRound className="h-3.5 w-3.5 mr-1" /> Password</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={changePassword}>
                  <DialogHeader><DialogTitle>Change password</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>New password</Label>
                      <Input type="password" required value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Confirm</Label>
                      <Input type="password" required value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Update</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="outline" onClick={enableMfaFlag}>
              <Fingerprint className="h-3.5 w-3.5 mr-1" /> Enable MFA
            </Button>
            <Dialog open={reqOpen} onOpenChange={setReqOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Request access</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submitAccess}>
                  <DialogHeader><DialogTitle>Access request</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Type</Label>
                      <Select value={reqForm.request_type} onValueChange={(v) => setReqForm((f) => ({ ...f, request_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["role", "permission", "module", "mfa", "device", "other"].map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input required value={reqForm.title} onChange={(e) => setReqForm((f) => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Role (if requesting)</Label>
                      <Select value={reqForm.role_id || "none"} onValueChange={(v) => setReqForm((f) => ({ ...f, role_id: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {availableRoles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input value={reqForm.description} onChange={(e) => setReqForm((f) => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Submit</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/service-desk/portal"><Shield className="h-3.5 w-3.5 mr-1" /> Report issue</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCircle className="h-4 w-4" /> My roles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {roles.length === 0 && <p className="text-sm text-muted-foreground">{role?.name || "Primary role only"}</p>}
            {roles.map((r) => {
              const rr = r.roles as { name?: string } | null;
              return (
                <div key={String(r.id)} className="flex justify-between text-sm border-b py-1">
                  <span>{rr?.name || "—"}</span>
                  {r.is_primary ? <Badge variant="outline" className="text-[10px]">Primary</Badge> : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4" /> My devices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {devices.length === 0 && <p className="text-sm text-muted-foreground">No registered devices.</p>}
            {devices.map((d) => (
              <div key={String(d.id)} className="flex justify-between text-sm border-b py-1">
                <span>{String(d.device_name)} · {String(d.device_type)}</span>
                <StatusBadge status={String(d.security_status || "trusted")} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">My access requests</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {requests.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
          {requests.map((r) => (
            <div key={String(r.id)} className="flex justify-between text-sm border-b py-1.5">
              <div>
                <div className="font-medium">{String(r.title)}</div>
                <div className="text-xs font-mono text-muted-foreground">{String(r.request_number)}</div>
              </div>
              <StatusBadge status={String(r.status)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
