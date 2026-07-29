"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";
import {
  orchestrateHire,
  listProvisionTemplates,
  DEFAULT_PROVISION_STEPS,
  CLEARANCE_LEVELS,
} from "@/lib/digital-identity";
import { toast } from "sonner";

export default function HireOrchestrationPage() {
  const { auth } = useUser();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    middle_name: "",
    email: "",
    phone: "",
    department: "",
    job_title: "",
    branch_name: "Kampala Branch",
    employment_type: "permanent",
    grade: "",
    hire_date: new Date().toISOString().slice(0, 10),
    clearance_level: "employee",
    template_code: "PERM-STAFF",
  });

  useEffect(() => {
    if (!auth) return;
    listProvisionTemplates(auth.profile.company_id)
      .then((t) => setTemplates(t as Array<Record<string, unknown>>))
      .catch(() => setTemplates([]));
  }, [auth]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error("First name, last name, and email are required");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const r = await orchestrateHire({
        company_id: auth.profile.company_id,
        first_name: form.first_name,
        last_name: form.last_name,
        middle_name: form.middle_name || undefined,
        email: form.email,
        phone: form.phone || undefined,
        department: form.department || undefined,
        job_title: form.job_title || undefined,
        branch_name: form.branch_name || undefined,
        employment_type: form.employment_type,
        grade: form.grade || undefined,
        hire_date: form.hire_date,
        clearance_level: form.clearance_level as "employee",
        template_code: form.template_code,
        actor_id: auth.user.id,
      });
      setResult(r as unknown as Record<string, unknown>);
      toast.success(`Hire complete · ${r.job_number} · ${r.status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Orchestration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Hire & Auto-Provision"
        description="HR creates employee once → ERP user, email, HopeChat, payroll, ID card, MFA, portal"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> New hire form
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label>First name *</Label>
                  <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
                </div>
                <div>
                  <Label>Middle name</Label>
                  <Input value={form.middle_name} onChange={(e) => set("middle_name", e.target.value)} />
                </div>
                <div>
                  <Label>Last name *</Label>
                  <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Company email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
                </div>
                <div>
                  <Label>Mobile</Label>
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Department</Label>
                  <Input value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="Production" />
                </div>
                <div>
                  <Label>Position / job title</Label>
                  <Input value={form.job_title} onChange={(e) => set("job_title", e.target.value)} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Branch</Label>
                  <Input value={form.branch_name} onChange={(e) => set("branch_name", e.target.value)} />
                </div>
                <div>
                  <Label>Grade</Label>
                  <Input value={form.grade} onChange={(e) => set("grade", e.target.value)} placeholder="G5" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Employment type</Label>
                  <Select value={form.employment_type} onValueChange={(v) => set("employment_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Hire date</Label>
                  <Input type="date" value={form.hire_date} onChange={(e) => set("hire_date", e.target.value)} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Provision template</Label>
                  <Select value={form.template_code} onValueChange={(v) => set("template_code", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(templates.length ? templates : [
                        { code: "PERM-STAFF", name: "Permanent Staff" },
                        { code: "CONTRACTOR", name: "Contractor" },
                        { code: "INTERN", name: "Intern" },
                        { code: "MGMT", name: "Management" },
                      ]).map((t) => (
                        <SelectItem key={String(t.code)} value={String(t.code)}>
                          {String(t.name || t.code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Security clearance</Label>
                  <Select value={form.clearance_level} onValueChange={(v) => set("clearance_level", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CLEARANCE_LEVELS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                {busy ? "Provisioning…" : "Create master identity & provision all modules"}
              </Button>
            </form>

            {result && (
              <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
                <div className="flex items-center gap-2 font-semibold text-emerald-800 mb-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Job {String(result.job_number)} · {String(result.status)}
                </div>
                <pre className="text-xs overflow-auto max-h-40 bg-white/60 p-2 rounded">
                  {JSON.stringify(result.results || result, null, 2)}
                </pre>
                <div className="flex gap-2 mt-3">
                  {result.person_id != null && String(result.person_id) !== "" && (
                    <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/identity/persons/${String(result.person_id)}`)}>
                      Open person 360°
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => router.push("/dashboard/identity/engine")}>
                    Provision engine
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auto-created checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {DEFAULT_PROVISION_STEPS.map((s) => (
              <div key={s.step_key} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-hope-gold shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{s.label}</p>
                  <p className="text-muted-foreground">
                    {s.module}
                    {s.required ? "" : " · optional"}
                  </p>
                </div>
              </div>
            ))}
            <Badge variant="outline" className="mt-2">No manual duplication</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
