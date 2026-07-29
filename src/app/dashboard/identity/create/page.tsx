"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import {
  USER_TYPES, USERNAME_PATTERNS, DATA_SCOPES,
  createProvisionRequest, resolveUsername, activateProvisionRequest,
} from "@/lib/idm";

export default function CreateAccountPage() {
  const { auth } = useUser();
  const [roles, setRoles] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [managers, setManagers] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; employee_number: string; first_name: string; last_name: string; email: string | null }>>([]);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ request_number: string; temp_password?: string; email?: string } | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    username: "",
    user_type: "employee",
    employee_id: "",
    employee_record_id: "",
    department: "",
    division: "",
    team_name: "",
    branch_name: "",
    location_name: "",
    cost_center: "",
    job_title: "",
    role_id: "",
    manager_user_id: "",
    data_scope: "company",
    username_pattern: "firstname.lastname",
    require_mfa: false,
    skip_approval: false,
    activate_now: false,
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: r }, { data: m }, { data: e }] = await Promise.all([
        supabase.from("roles").select("id,name,slug").eq("is_active", true).order("name"),
        supabase.from("user_profiles").select("id,first_name,last_name").eq("is_active", true).limit(100),
        supabase.from("employees").select("id,employee_number,first_name,last_name,email").is("deleted_at", null).limit(200),
      ]);
      setRoles((r as typeof roles) || []);
      setManagers((m as typeof managers) || []);
      setEmployees((e as typeof employees) || []);
    }
    load().catch(() => {});
  }, []);

  const genUsername = async () => {
    if (!companyId || !form.first_name) return;
    try {
      const u = await resolveUsername(companyId, {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        employee_id: form.employee_id,
        department: form.department,
        pattern: form.username_pattern,
      });
      setForm((f) => ({ ...f, username: u }));
      toast.success(`Username: ${u}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const fillFromEmployee = (empId: string) => {
    const e = employees.find((x) => x.id === empId);
    if (!e) return;
    setForm((f) => ({
      ...f,
      employee_record_id: e.id,
      employee_id: e.employee_number,
      first_name: e.first_name,
      last_name: e.last_name,
      email: e.email || f.email,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return toast.error("No company");
    setSaving(true);
    setCreated(null);
    try {
      let username = form.username;
      if (!username) {
        username = await resolveUsername(companyId, {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          employee_id: form.employee_id,
          department: form.department,
          pattern: form.username_pattern,
        });
      }

      const req = await createProvisionRequest({
        company_id: companyId,
        requested_by: auth?.user?.id,
        require_approval: !form.skip_approval && !form.activate_now,
        data: {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone || null,
          username,
          user_type: form.user_type,
          employee_id: form.employee_id || null,
          employee_record_id: form.employee_record_id || null,
          department: form.department || null,
          division: form.division || null,
          team_name: form.team_name || null,
          branch_name: form.branch_name || null,
          location_name: form.location_name || null,
          cost_center: form.cost_center || null,
          job_title: form.job_title || null,
          role_id: form.role_id || null,
          role_ids: form.role_id ? [form.role_id] : [],
          manager_user_id: form.manager_user_id || null,
          data_scope: form.data_scope,
          require_mfa: form.require_mfa,
          source: form.employee_record_id ? "hr_onboarding" : "manual",
        },
      });

      if (form.activate_now && auth?.user?.id) {
        // Ensure approved then activate
        if (req.status !== "admin_approved") {
          await createClient()
            .from("idm_provision_requests")
            .update({
              status: "admin_approved",
              admin_approved_by: auth.user.id,
              admin_approved_at: new Date().toISOString(),
            })
            .eq("id", req.id);
        }
        const result = await activateProvisionRequest(req.id, auth.user.id);
        setCreated({
          request_number: req.request_number,
          temp_password: result.temp_password,
          email: result.email,
        });
        toast.success(`Account activated for ${result.email}`);
      } else {
        setCreated({ request_number: req.request_number });
        toast.success(`Request ${req.request_number} submitted for approval`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Create User Account"
        description="Manual provisioning · organization assignment · roles · MFA · activation"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/identity/provision">View queue</Link>
          </Button>
        }
      />

      {created && (
        <Card className="mb-6 border-green-200 bg-green-50/50">
          <CardContent className="pt-4 text-sm space-y-1">
            <p className="font-medium">Request {created.request_number}</p>
            {created.temp_password ? (
              <>
                <p>Account activated. Temporary password (share securely, force-change on first login):</p>
                <code className="block rounded bg-background border px-3 py-2 font-mono text-sm">
                  {created.temp_password}
                </code>
                <p className="text-muted-foreground">Email: {created.email}</p>
              </>
            ) : (
              <p className="text-muted-foreground">
                Pending approval workflow (Manager → Security → Admin). Activate from Provisioning queue.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Basic information</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div>
              <Label>Link employee (optional)</Label>
              <Select
                value={form.employee_record_id || "none"}
                onValueChange={(v) => {
                  if (v === "none") setForm((f) => ({ ...f, employee_record_id: "" }));
                  else fillFromEmployee(v);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — manual</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.employee_number} — {e.first_name} {e.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>First name</Label>
                <Input required value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div>
                <Label>Last name</Label>
                <Input required value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <Label>Employee ID</Label>
                <Input value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>User type</Label>
              <Select value={form.user_type} onValueChange={(v) => setForm((f) => ({ ...f, user_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {USER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Username rule</Label>
              <div className="flex gap-2">
                <Select value={form.username_pattern} onValueChange={(v) => setForm((f) => ({ ...f, username_pattern: v }))}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {USERNAME_PATTERNS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label} ({p.example})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={genUsername}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Username</Label>
              <Input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="Auto if empty" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Organization & access</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Department</Label>
                <Input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
              </div>
              <div>
                <Label>Division</Label>
                <Input value={form.division} onChange={(e) => setForm((f) => ({ ...f, division: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Team</Label>
                <Input value={form.team_name} onChange={(e) => setForm((f) => ({ ...f, team_name: e.target.value }))} />
              </div>
              <div>
                <Label>Branch</Label>
                <Input value={form.branch_name} onChange={(e) => setForm((f) => ({ ...f, branch_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Location</Label>
                <Input value={form.location_name} onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))} />
              </div>
              <div>
                <Label>Cost center</Label>
                <Input value={form.cost_center} onChange={(e) => setForm((f) => ({ ...f, cost_center: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Job title</Label>
              <Input value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} />
            </div>
            <div>
              <Label>Primary role</Label>
              <Select value={form.role_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, role_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default employee</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reporting manager</Label>
              <Select value={form.manager_user_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, manager_user_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data access scope</Label>
              <Select value={form.data_scope} onValueChange={(v) => setForm((f) => ({ ...f, data_scope: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DATA_SCOPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.require_mfa} onChange={(e) => setForm((f) => ({ ...f, require_mfa: e.target.checked }))} />
              Require MFA
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.skip_approval} onChange={(e) => setForm((f) => ({ ...f, skip_approval: e.target.checked }))} />
              Skip multi-step approval (admin direct)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.activate_now} onChange={(e) => setForm((f) => ({ ...f, activate_now: e.target.checked }))} />
              Activate immediately (create login + temp password)
            </label>
            <Button type="submit" disabled={saving} className="mt-2">
              <UserPlus className="h-4 w-4 mr-1" />
              {saving ? "Saving…" : form.activate_now ? "Create & activate" : "Submit for approval"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
