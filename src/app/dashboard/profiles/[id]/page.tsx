"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import {
  User, Briefcase, History, IdCard, Shield, FileText, Award,
  GraduationCap, Target, Clock, Wallet, FolderKanban, Laptop,
  LifeBuoy, Lock, Pencil, RefreshCw, Plus,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import {
  loadProfile360,
  updateEmployeeProfile,
  refreshCompletion,
  addSkill,
  addCertification,
  addDocument,
  addTimelineEvent,
  resolveSectionAccess,
  maskPayrollValue,
  generateProfileInsights,
  DOC_TYPES,
  SKILL_CATEGORIES,
  SKILL_LEVELS,
  TIMELINE_EVENT_TYPES,
  BLOOD_GROUPS,
  EMPLOYMENT_TYPES,
  type EmployeeProfile,
} from "@/lib/profile";

export default function Profile360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { auth } = useUser();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadProfile360>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const result = await loadProfile360(id);
    setData(result);
    if (result.employee) {
      const e = result.employee;
      setEditForm({
        phone: e.phone || "",
        personal_email: e.personal_email || e.email || "",
        alt_phone: e.alt_phone || "",
        residential_address: e.residential_address || e.address || "",
        emergency_contact: e.emergency_contact || "",
        emergency_phone: e.emergency_phone || "",
        blood_group: e.blood_group || "",
        languages: e.languages || "",
        department: e.department || "",
        job_title: e.job_title || "",
        job_grade: e.job_grade || "",
        employment_type: e.employment_type || "permanent",
        division: e.division || "",
        team_name: e.team_name || "",
        work_location: e.work_location || "",
        shift_name: e.shift_name || "",
        working_hours: e.working_hours || "",
        national_id: e.national_id || "",
        passport_number: e.passport_number || "",
        gender: e.gender || "",
        nationality: e.nationality || "",
        marital_status: e.marital_status || "",
        date_of_birth: e.date_of_birth || "",
        bio: e.bio || "",
        security_clearance: e.security_clearance || "standard",
        salary_grade: e.salary_grade || "",
        payroll_number: e.payroll_number || "",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [id]);

  const access = useMemo(() => {
    const emp = data?.employee;
    const perms = auth?.permissions || [];
    const isSelf = Boolean(emp?.user_id && emp.user_id === auth?.user?.id);
    const isHr = perms.some((p) => p.startsWith("hr.") || p.startsWith("profile.manage"));
    const isFinance = perms.some((p) => p.startsWith("finance.") || p === "profile.payroll");
    const isAdmin = perms.includes("settings.manage") || perms.includes("iam.manage");
    return resolveSectionAccess({
      permissions: perms,
      isSelf,
      isManagerOf: false,
      isHr,
      isFinance,
      isAdmin,
    });
  }, [data, auth]);

  const insights = useMemo(() => {
    if (!data?.employee) return [];
    const att = data.attendance || [];
    const present = att.filter((a: { status?: string }) => a.status === "present").length;
    const rate = att.length ? Math.round((present / att.length) * 100) : 100;
    return generateProfileInsights({
      employee: data.employee,
      ctx: {
        skillCount: data.skills?.length || 0,
        certCount: data.certifications?.length || 0,
        docCount: data.documents?.length || 0,
      },
      skills: (data.skills || []) as Array<{ skill_name: string; skill_category: string; level_score: number }>,
      certs: (data.certifications || []) as Array<{ certificate_name: string; expiry_date?: string | null }>,
      attendanceRate: rate,
      leaveBalance: Number(data.employee.leave_balance_days || 0),
      openTickets: (data.tickets || []).filter((t: { status?: string }) => t.status === "open").length,
    });
  }, [data]);

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !data?.employee) return;
    setSaving(true);
    try {
      await updateEmployeeProfile(data.employee.id, companyId, editForm, auth?.user?.id);
      toast.success("Profile updated");
      setEditOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = async () => {
    if (!companyId || !data?.employee) return;
    try {
      const r = await refreshCompletion(data.employee.id, companyId);
      toast.success(`Completion recalculated: ${r.pct}%`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading 360° profile…" />;
  if (!data?.employee) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Profile not found.</p>
        <Button asChild className="mt-4"><Link href="/dashboard/profiles">Back to directory</Link></Button>
      </div>
    );
  }

  const e = data.employee as EmployeeProfile;
  const pct = Number(e.profile_completion_pct || data.completion?.completion_pct || 0);
  const missing = (data.completion?.missing_fields as string[]) || insights[0]?.actions || [];

  return (
    <div>
      <PageHeader
        title={`${e.first_name} ${e.last_name}`}
        description={`${e.employee_number} · ${e.job_title || "Staff"} · ${e.department || "—"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-1" /> Completion
            </Button>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <form onSubmit={saveEdit}>
                  <DialogHeader><DialogTitle>Update profile</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3 max-h-[60vh] overflow-y-auto">
                    {[
                      ["phone", "Phone"],
                      ["personal_email", "Email"],
                      ["alt_phone", "Alt phone"],
                      ["national_id", "National ID"],
                      ["passport_number", "Passport"],
                      ["date_of_birth", "Date of birth"],
                      ["gender", "Gender"],
                      ["nationality", "Nationality"],
                      ["marital_status", "Marital status"],
                      ["residential_address", "Address"],
                      ["emergency_contact", "Emergency contact"],
                      ["emergency_phone", "Emergency phone"],
                      ["languages", "Languages"],
                      ["department", "Department"],
                      ["division", "Division"],
                      ["team_name", "Team"],
                      ["job_title", "Job title"],
                      ["job_grade", "Job grade"],
                      ["work_location", "Work location"],
                      ["shift_name", "Shift"],
                      ["working_hours", "Working hours"],
                      ["security_clearance", "Security clearance"],
                      ["salary_grade", "Salary grade"],
                      ["payroll_number", "Payroll number"],
                      ["bio", "Bio"],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <Label>{label}</Label>
                        {key === "blood_group" ? null : key === "employment_type" ? null : (
                          <Input
                            type={key === "date_of_birth" ? "date" : "text"}
                            value={editForm[key] || ""}
                            onChange={(ev) => setEditForm((f) => ({ ...f, [key]: ev.target.value }))}
                          />
                        )}
                      </div>
                    ))}
                    <div>
                      <Label>Blood group</Label>
                      <Select value={editForm.blood_group || "none"} onValueChange={(v) => setEditForm((f) => ({ ...f, blood_group: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {BLOOD_GROUPS.map((b) => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Employment type</Label>
                      <Select value={editForm.employment_type || "permanent"} onValueChange={(v) => setEditForm((f) => ({ ...f, employment_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EMPLOYMENT_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4 mb-6">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary mb-3 overflow-hidden">
              {e.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                `${e.first_name?.[0] || ""}${e.last_name?.[0] || ""}`
              )}
            </div>
            <h2 className="font-semibold">{e.first_name} {e.last_name}</h2>
            <p className="text-sm text-muted-foreground">{e.job_title || "—"}</p>
            <p className="text-xs font-mono mt-1">{e.employee_number}</p>
            <StatusBadge status={e.status || "active"} className="mt-2" />
            <div className="w-full mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span>Profile completion</span>
                <span className="font-medium">{formatNumber(pct)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              {missing.length > 0 && (
                <ul className="mt-3 text-left text-xs text-muted-foreground space-y-1">
                  {(Array.isArray(missing) ? missing : []).slice(0, 6).map((m) => (
                    <li key={String(m)}>○ {String(m)}</li>
                  ))}
                </ul>
              )}
            </div>
            {data.manager && (
              <p className="text-xs mt-4 text-muted-foreground">
                Manager: {(data.manager as { first_name: string; last_name: string }).first_name}{" "}
                {(data.manager as { last_name: string }).last_name}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {insights.slice(0, 6).map((ins, i) => (
            <Card key={i}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] capitalize">{ins.severity}</Badge>
                  {ins.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xs text-muted-foreground">{ins.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Tabs defaultValue="personal">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="personal"><User className="h-3.5 w-3.5 mr-1" />Personal</TabsTrigger>
          <TabsTrigger value="job"><Briefcase className="h-3.5 w-3.5 mr-1" />Job</TabsTrigger>
          <TabsTrigger value="timeline"><History className="h-3.5 w-3.5 mr-1" />Timeline</TabsTrigger>
          <TabsTrigger value="identity"><IdCard className="h-3.5 w-3.5 mr-1" />ID Card</TabsTrigger>
          <TabsTrigger value="account"><Shield className="h-3.5 w-3.5 mr-1" />Account</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="h-3.5 w-3.5 mr-1" />Docs</TabsTrigger>
          <TabsTrigger value="skills"><Award className="h-3.5 w-3.5 mr-1" />Skills</TabsTrigger>
          <TabsTrigger value="training"><GraduationCap className="h-3.5 w-3.5 mr-1" />Training</TabsTrigger>
          <TabsTrigger value="performance"><Target className="h-3.5 w-3.5 mr-1" />Performance</TabsTrigger>
          <TabsTrigger value="attendance"><Clock className="h-3.5 w-3.5 mr-1" />Attendance</TabsTrigger>
          <TabsTrigger value="payroll"><Wallet className="h-3.5 w-3.5 mr-1" />Payroll</TabsTrigger>
          <TabsTrigger value="projects"><FolderKanban className="h-3.5 w-3.5 mr-1" />Projects</TabsTrigger>
          <TabsTrigger value="assets"><Laptop className="h-3.5 w-3.5 mr-1" />Assets</TabsTrigger>
          <TabsTrigger value="helpdesk"><LifeBuoy className="h-3.5 w-3.5 mr-1" />Helpdesk</TabsTrigger>
          <TabsTrigger value="security"><Lock className="h-3.5 w-3.5 mr-1" />Security</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          {access.personal ? (
            <Card>
              <CardContent className="pt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <Field label="Full name" value={`${e.first_name} ${e.middle_name || ""} ${e.last_name}`} />
                <Field label="National ID" value={e.national_id} />
                <Field label="Passport" value={e.passport_number} />
                <Field label="Date of birth" value={e.date_of_birth ? formatDate(e.date_of_birth) : null} />
                <Field label="Gender" value={e.gender} />
                <Field label="Nationality" value={e.nationality} />
                <Field label="Marital status" value={e.marital_status} />
                <Field label="Blood group" value={e.blood_group} />
                <Field label="Languages" value={e.languages} />
                <Field label="Email" value={e.personal_email || e.email} />
                <Field label="Phone" value={e.phone} />
                <Field label="Alt phone" value={e.alt_phone} />
                <Field label="Address" value={e.residential_address || e.address} className="sm:col-span-2" />
                <Field label="Emergency" value={e.emergency_contact ? `${e.emergency_contact} · ${e.emergency_phone || ""}` : null} />
              </CardContent>
            </Card>
          ) : (
            <Restricted />
          )}
        </TabsContent>

        <TabsContent value="job" className="mt-4">
          <Card>
            <CardContent className="pt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <Field label="Employee number" value={e.employee_number} />
              <Field label="Employment type" value={e.employment_type} />
              <Field label="Status" value={e.status} />
              <Field label="Company branch" value={e.branch_name} />
              <Field label="Department" value={e.department} />
              <Field label="Division" value={e.division} />
              <Field label="Team" value={e.team_name} />
              <Field label="Cost center" value={e.cost_center} />
              <Field label="Location" value={e.work_location} />
              <Field label="Job title" value={e.job_title} />
              <Field label="Position" value={e.position_title} />
              <Field label="Grade" value={e.job_grade} />
              <Field label="Shift" value={e.shift_name} />
              <Field label="Working hours" value={e.working_hours} />
              <Field label="Hire date" value={e.hire_date ? formatDate(e.hire_date) : null} />
              <Field label="Confirmation" value={e.confirmation_date ? formatDate(e.confirmation_date) : null} />
              <Field label="Experience (yrs)" value={e.experience_years != null ? String(e.experience_years) : null} />
              <Field label="Qualifications" value={e.qualifications} className="sm:col-span-2" />
              <Field label="Responsibilities" value={e.responsibilities || e.job_description} className="sm:col-span-3" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <div className="flex justify-end mb-2">
            <Dialog open={eventOpen} onOpenChange={setEventOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Event</Button>
              </DialogTrigger>
              <DialogContent>
                <TimelineForm
                  onSave={async (form) => {
                    if (!companyId) return;
                    await addTimelineEvent({
                      company_id: companyId,
                      employee_id: e.id,
                      ...form,
                      created_by: auth?.user?.id,
                    });
                    toast.success("Timeline event added");
                    setEventOpen(false);
                    await load();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative border-l-2 border-muted ml-3 space-y-4 pl-6">
            {(data.timeline || []).map((t: Record<string, unknown>) => (
              <div key={String(t.id)} className="relative">
                <div className="absolute -left-[1.9rem] top-1 h-3 w-3 rounded-full bg-primary" />
                <div className="text-xs text-muted-foreground">{t.event_date ? formatDate(String(t.event_date)) : ""}</div>
                <div className="font-medium text-sm">{String(t.title)}</div>
                <div className="text-xs text-muted-foreground capitalize">{String(t.event_type)}</div>
                {Boolean(t.description) && <p className="text-sm mt-0.5">{String(t.description)}</p>}
                {(Boolean(t.from_value) || Boolean(t.to_value)) && (
                  <p className="text-xs mt-0.5">{String(t.from_value || "")} → {String(t.to_value || "")}</p>
                )}
              </div>
            ))}
            {(data.timeline || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No career events yet.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="identity" className="mt-4">
          {access.identity ? (
            <Card>
              <CardContent className="pt-6 space-y-4">
                {data.identity ? (
                  <>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <Field label="Identity number" value={(data.identity as { identity_number?: string }).identity_number} />
                      <Field label="Status" value={(data.identity as { status?: string }).status} />
                      <Field label="Clearance" value={(data.identity as { security_clearance?: string }).security_clearance} />
                      <Field label="Expiry" value={(data.identity as { expiry_date?: string }).expiry_date} />
                    </div>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href="/dashboard/credentials">View digital ID</Link>
                      </Button>
                    </div>
                    {(data.credentials as Array<Record<string, unknown>>).length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Credential</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>RFID / Serial</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(data.credentials as Array<Record<string, unknown>>).map((c) => (
                            <TableRow key={String(c.id)}>
                              <TableCell className="font-mono text-sm">{String(c.credential_number || c.card_number || c.id).slice(0, 16)}</TableCell>
                              <TableCell><StatusBadge status={String(c.status || "active")} /></TableCell>
                              <TableCell className="text-xs">{String(c.rfid_uid || c.serial_number || "—")}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No workforce identity linked. Create one under{" "}
                    <Link href="/dashboard/credentials" className="underline">ID Credentials</Link>.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Restricted />
          )}
        </TabsContent>

        <TabsContent value="account" className="mt-4">
          {access.account ? (
            <Card>
              <CardContent className="pt-6 grid sm:grid-cols-2 gap-4 text-sm">
                {data.account ? (
                  <>
                    <Field label="Email account" value={(data.account as { email?: string }).email} />
                    <Field label="MFA" value={(data.account as { mfa_enabled?: boolean }).mfa_enabled ? "Enabled" : "Disabled"} />
                    <Field label="Active" value={(data.account as { is_active?: boolean }).is_active ? "Yes" : "No"} />
                    <Field
                      label="Last login"
                      value={
                        (data.account as { last_login_at?: string }).last_login_at
                          ? formatDate(String((data.account as { last_login_at: string }).last_login_at))
                          : null
                      }
                    />
                    <Field
                      label="Role"
                      value={
                        ((data.account as { roles?: { name?: string } | null }).roles as { name?: string } | null)?.name
                      }
                    />
                    <Button asChild size="sm" variant="outline" className="w-fit">
                      <Link href="/dashboard/identity">Open IAM</Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No IAM user linked to this employee.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Restricted />
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          {access.documents ? (
            <>
              <div className="flex justify-end mb-2">
                <Dialog open={docOpen} onOpenChange={setDocOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Document</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DocForm
                      onSave={async (form) => {
                        if (!companyId) return;
                        await addDocument({
                          company_id: companyId,
                          employee_id: e.id,
                          ...form,
                          uploaded_by: auth?.user?.id,
                        });
                        toast.success("Document registered");
                        setDocOpen(false);
                        await load();
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
              <SimpleTable
                columns={["Title", "Type", "Status", "Expires"]}
                rows={(data.documents || []).map((d: Record<string, unknown>) => [
                  String(d.title),
                  String(d.doc_type),
                  String(d.status),
                  d.expires_on ? formatDate(String(d.expires_on)) : "—",
                ])}
              />
            </>
          ) : (
            <Restricted />
          )}
        </TabsContent>

        <TabsContent value="skills" className="mt-4">
          <div className="flex gap-2 justify-end mb-2">
            <Dialog open={skillOpen} onOpenChange={setSkillOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Skill</Button>
              </DialogTrigger>
              <DialogContent>
                <SkillForm
                  onSave={async (form) => {
                    if (!companyId) return;
                    await addSkill({ company_id: companyId, employee_id: e.id, ...form });
                    toast.success("Skill added");
                    setSkillOpen(false);
                    await load();
                  }}
                />
              </DialogContent>
            </Dialog>
            <Dialog open={certOpen} onOpenChange={setCertOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Certificate</Button>
              </DialogTrigger>
              <DialogContent>
                <CertForm
                  onSave={async (form) => {
                    if (!companyId) return;
                    await addCertification({ company_id: companyId, employee_id: e.id, ...form });
                    toast.success("Certificate added");
                    setCertOpen(false);
                    await load();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Skills</CardTitle></CardHeader>
              <CardContent>
                <SimpleTable
                  columns={["Skill", "Category", "Level", "Years"]}
                  rows={(data.skills || []).map((s: Record<string, unknown>) => [
                    String(s.skill_name),
                    String(s.skill_category),
                    String(s.level_label),
                    String(s.years_experience ?? 0),
                  ])}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Certifications</CardTitle></CardHeader>
              <CardContent>
                <SimpleTable
                  columns={["Certificate", "Issuer", "Expiry", "Status"]}
                  rows={(data.certifications || []).map((c: Record<string, unknown>) => [
                    String(c.certificate_name),
                    String(c.issuing_org || "—"),
                    c.expiry_date ? formatDate(String(c.expiry_date)) : "—",
                    String(c.status),
                  ])}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="training" className="mt-4">
          <SimpleTable
            columns={["Course", "Status", "Score", "Completed"]}
            rows={(data.training || []).map((t: Record<string, unknown>) => {
              const course = t.training_courses as { title?: string } | null;
              return [
                course?.title || "—",
                String(t.status),
                t.score != null ? String(t.score) : "—",
                t.completed_at ? formatDate(String(t.completed_at)) : "—",
              ];
            })}
          />
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          {access.performance ? (
            <SimpleTable
              columns={["Review", "Period", "Rating", "Score", "Status"]}
              rows={(data.reviews || []).map((r: Record<string, unknown>) => [
                String(r.review_number),
                String(r.period_label || "—"),
                String(r.rating || "—"),
                r.score != null ? String(r.score) : "—",
                String(r.status),
              ])}
            />
          ) : (
            <Restricted />
          )}
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          {access.attendance ? (
            <>
              <div className="grid sm:grid-cols-3 gap-3 mb-4 text-sm">
                <Card><CardContent className="pt-4"><div className="text-muted-foreground text-xs">Leave balance</div><div className="text-xl font-semibold">{formatNumber(e.leave_balance_days || 0)} days</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-muted-foreground text-xs">Recent records</div><div className="text-xl font-semibold">{(data.attendance || []).length}</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-muted-foreground text-xs">Leave requests</div><div className="text-xl font-semibold">{(data.leave || []).length}</div></CardContent></Card>
              </div>
              <SimpleTable
                columns={["Date", "In", "Out", "Status"]}
                rows={(data.attendance || []).map((a: Record<string, unknown>) => [
                  a.work_date ? formatDate(String(a.work_date)) : "—",
                  a.check_in ? new Date(String(a.check_in)).toLocaleTimeString() : "—",
                  a.check_out ? new Date(String(a.check_out)).toLocaleTimeString() : "—",
                  String(a.status || "—"),
                ])}
              />
            </>
          ) : (
            <Restricted />
          )}
        </TabsContent>

        <TabsContent value="payroll" className="mt-4">
          {access.payroll ? (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <Field label="Salary grade" value={e.salary_grade} />
                <Field label="Payroll number" value={e.payroll_number} />
                <Field label="Bank" value={e.bank_name ? `${e.bank_name} · ${e.bank_account || ""}` : null} />
                <Field label="TIN" value={e.tin_number} />
                <Field label="NSSF" value={e.nssf_number} />
                <Field label="Base salary" value={e.salary != null ? `${e.currency || "UGX"} ${formatNumber(e.salary)}` : null} />
              </div>
              <SimpleTable
                columns={["Period", "Gross", "PAYE", "Net"]}
                rows={(data.payrollLines || []).map((p: Record<string, unknown>) => [
                  p.created_at ? formatDate(String(p.created_at)) : "—",
                  formatNumber(Number(p.gross_pay || 0)),
                  formatNumber(Number(p.paye || 0)),
                  formatNumber(Number(p.net_pay || 0)),
                ])}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Payroll data is restricted. {maskPayrollValue("hidden", false)} — finance/HR payroll permission required.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <SimpleTable
            columns={["Project", "Role", "Progress", "Hours", "Status"]}
            rows={(data.projects || []).map((p: Record<string, unknown>) => [
              String(p.project_name),
              String(p.role_on_project || "—"),
              `${formatNumber(Number(p.progress_pct || 0))}%`,
              formatNumber(Number(p.hours_worked || 0)),
              String(p.status),
            ])}
          />
        </TabsContent>

        <TabsContent value="assets" className="mt-4">
          <SimpleTable
            columns={["Asset", "Type", "Tag", "Issued", "Status"]}
            rows={(data.assets || []).map((a: Record<string, unknown>) => [
              String(a.description),
              String(a.asset_type),
              String(a.asset_tag || "—"),
              a.issued_date ? formatDate(String(a.issued_date)) : "—",
              String(a.status),
            ])}
          />
        </TabsContent>

        <TabsContent value="helpdesk" className="mt-4">
          <SimpleTable
            columns={["Ticket", "Subject", "Priority", "Status"]}
            rows={(data.tickets || []).map((t: Record<string, unknown>) => [
              String(t.ticket_number),
              String(t.subject),
              String(t.priority),
              String(t.status),
            ])}
          />
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          {access.security ? (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <Field label="Access level" value={e.access_level} />
                <Field label="Security clearance" value={e.security_clearance} />
                <Field label="Login risk score" value={String(e.login_risk_score ?? 0)} />
              </div>
              <SimpleTable
                columns={["When", "Event", "Severity", "Message"]}
                rows={(data.securityEvents || []).map((s: Record<string, unknown>) => [
                  s.created_at ? formatDate(String(s.created_at)) : "—",
                  String(s.event_type),
                  String(s.severity),
                  String(s.message || "—"),
                ])}
              />
            </div>
          ) : (
            <Restricted />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium capitalize break-words">{value || "—"}</div>
    </div>
  );
}

function Restricted() {
  return (
    <Card>
      <CardContent className="pt-6 text-sm text-muted-foreground">
        You do not have permission to view this section.
      </CardContent>
    </Card>
  );
}

function SimpleTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground p-4 border rounded-md">No records.</p>;
  }
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {r.map((cell, j) => (
                <TableCell key={j} className="text-sm">{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SkillForm({
  onSave,
}: {
  onSave: (f: {
    skill_name: string;
    skill_category: string;
    level_label: string;
    level_score: number;
    years_experience: number;
  }) => Promise<void>;
}) {
  const [f, setF] = useState({
    skill_name: "",
    skill_category: "technical",
    level_label: "intermediate",
    years_experience: "1",
  });
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const lvl = SKILL_LEVELS.find((l) => l.value === f.level_label);
        try {
          await onSave({
            skill_name: f.skill_name,
            skill_category: f.skill_category,
            level_label: f.level_label,
            level_score: lvl?.score ?? 3,
            years_experience: Number(f.years_experience) || 0,
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      <DialogHeader><DialogTitle>Add skill</DialogTitle></DialogHeader>
      <div className="grid gap-3 py-3">
        <div>
          <Label>Skill name</Label>
          <Input required value={f.skill_name} onChange={(e) => setF((x) => ({ ...x, skill_name: e.target.value }))} />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={f.skill_category} onValueChange={(v) => setF((x) => ({ ...x, skill_category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SKILL_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Level</Label>
            <Select value={f.level_label} onValueChange={(v) => setF((x) => ({ ...x, level_label: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SKILL_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Years</Label>
            <Input type="number" value={f.years_experience} onChange={(e) => setF((x) => ({ ...x, years_experience: e.target.value }))} />
          </div>
        </div>
      </div>
      <DialogFooter><Button type="submit" disabled={busy}>Save</Button></DialogFooter>
    </form>
  );
}

function CertForm({
  onSave,
}: {
  onSave: (f: {
    certificate_name: string;
    issuing_org?: string;
    certificate_number?: string;
    issue_date?: string;
    expiry_date?: string;
  }) => Promise<void>;
}) {
  const [f, setF] = useState({
    certificate_name: "",
    issuing_org: "",
    certificate_number: "",
    issue_date: "",
    expiry_date: "",
  });
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave(f);
        } finally {
          setBusy(false);
        }
      }}
    >
      <DialogHeader><DialogTitle>Add certification</DialogTitle></DialogHeader>
      <div className="grid gap-3 py-3">
        <div>
          <Label>Name</Label>
          <Input required value={f.certificate_name} onChange={(e) => setF((x) => ({ ...x, certificate_name: e.target.value }))} />
        </div>
        <div>
          <Label>Issuing organization</Label>
          <Input value={f.issuing_org} onChange={(e) => setF((x) => ({ ...x, issuing_org: e.target.value }))} />
        </div>
        <div>
          <Label>Number</Label>
          <Input value={f.certificate_number} onChange={(e) => setF((x) => ({ ...x, certificate_number: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Issue date</Label>
            <Input type="date" value={f.issue_date} onChange={(e) => setF((x) => ({ ...x, issue_date: e.target.value }))} />
          </div>
          <div>
            <Label>Expiry</Label>
            <Input type="date" value={f.expiry_date} onChange={(e) => setF((x) => ({ ...x, expiry_date: e.target.value }))} />
          </div>
        </div>
      </div>
      <DialogFooter><Button type="submit" disabled={busy}>Save</Button></DialogFooter>
    </form>
  );
}

function DocForm({
  onSave,
}: {
  onSave: (f: {
    doc_type: string;
    title: string;
    file_name?: string;
    file_url?: string;
    expires_on?: string;
  }) => Promise<void>;
}) {
  const [f, setF] = useState({
    doc_type: "national_id",
    title: "",
    file_name: "",
    file_url: "",
    expires_on: "",
  });
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave(f);
        } finally {
          setBusy(false);
        }
      }}
    >
      <DialogHeader><DialogTitle>Register document</DialogTitle></DialogHeader>
      <div className="grid gap-3 py-3">
        <div>
          <Label>Type</Label>
          <Select value={f.doc_type} onValueChange={(v) => setF((x) => ({ ...x, doc_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Title</Label>
          <Input required value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} />
        </div>
        <div>
          <Label>File name / URL</Label>
          <Input value={f.file_name} onChange={(e) => setF((x) => ({ ...x, file_name: e.target.value }))} placeholder="scan.pdf" />
          <Input className="mt-2" value={f.file_url} onChange={(e) => setF((x) => ({ ...x, file_url: e.target.value }))} placeholder="https://..." />
        </div>
        <div>
          <Label>Expires on</Label>
          <Input type="date" value={f.expires_on} onChange={(e) => setF((x) => ({ ...x, expires_on: e.target.value }))} />
        </div>
      </div>
      <DialogFooter><Button type="submit" disabled={busy}>Save</Button></DialogFooter>
    </form>
  );
}

function TimelineForm({
  onSave,
}: {
  onSave: (f: {
    event_type: string;
    title: string;
    description?: string;
    event_date?: string;
    from_value?: string;
    to_value?: string;
  }) => Promise<void>;
}) {
  const [f, setF] = useState({
    event_type: "promotion",
    title: "",
    description: "",
    event_date: new Date().toISOString().slice(0, 10),
    from_value: "",
    to_value: "",
  });
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave(f);
        } finally {
          setBusy(false);
        }
      }}
    >
      <DialogHeader><DialogTitle>Career event</DialogTitle></DialogHeader>
      <div className="grid gap-3 py-3">
        <div>
          <Label>Type</Label>
          <Select value={f.event_type} onValueChange={(v) => setF((x) => ({ ...x, event_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMELINE_EVENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Title</Label>
          <Input required value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={f.event_date} onChange={(e) => setF((x) => ({ ...x, event_date: e.target.value }))} />
        </div>
        <div>
          <Label>Description</Label>
          <Input value={f.description} onChange={(e) => setF((x) => ({ ...x, description: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>From</Label>
            <Input value={f.from_value} onChange={(e) => setF((x) => ({ ...x, from_value: e.target.value }))} />
          </div>
          <div>
            <Label>To</Label>
            <Input value={f.to_value} onChange={(e) => setF((x) => ({ ...x, to_value: e.target.value }))} />
          </div>
        </div>
      </div>
      <DialogFooter><Button type="submit" disabled={busy}>Save</Button></DialogFooter>
    </form>
  );
}
