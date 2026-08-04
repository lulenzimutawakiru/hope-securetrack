"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users, UserCircle, UserCog, FileText, BarChart3, Wand2,
  ClipboardList, Plus, Search, Download, ArrowRight, IdCard,
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import {
  EMPLOYMENT_TYPES,
  PROFILE_LIFECYCLE,
  createEmployeeProfile,
  exportProfilesCsv,
  type EmployeeProfile,
} from "@/lib/profile";

const MODULES = [
  { title: "Directory", href: "/dashboard/profiles", icon: Users, desc: "All digital employee profiles" },
  { title: "My Profile", href: "/dashboard/profiles/me", icon: UserCircle, desc: "Self-service portal" },
  { title: "My Team", href: "/dashboard/profiles/team", icon: UserCog, desc: "Manager 360° view" },
  { title: "Documents", href: "/dashboard/profiles/documents", icon: FileText, desc: "IDs · contracts · certs" },
  { title: "Requests", href: "/dashboard/profiles/requests", icon: ClipboardList, desc: "Approvals · ESS tickets" },
  { title: "Analytics", href: "/dashboard/profiles/analytics", icon: BarChart3, desc: "Completion · skills · growth" },
  { title: "AI Assistant", href: "/dashboard/profiles/ai", icon: Wand2, desc: "Gaps · career · retention" },
  { title: "ID Credentials", href: "/dashboard/credentials", icon: IdCard, desc: "Cards · QR · access" },
];

export default function ProfilesHubPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    department: "Production",
    job_title: "",
    employment_type: "permanent",
    hire_date: new Date().toISOString().slice(0, 10),
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("employees")
      .select("*")
      .is("deleted_at", null)
      .order("last_name")
      .limit(500);
    setRows((data as EmployeeProfile[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const departments = useMemo(() => {
    const set = new Set(rows.map((r) => r.department).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (dept !== "all") list = list.filter((r) => r.department === dept);
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (r) =>
        r.first_name?.toLowerCase().includes(s) ||
        r.last_name?.toLowerCase().includes(s) ||
        r.employee_number?.toLowerCase().includes(s) ||
        r.email?.toLowerCase().includes(s) ||
        r.job_title?.toLowerCase().includes(s)
    );
  }, [rows, q, dept]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === "active").length;
    const avg =
      rows.length > 0
        ? rows.reduce((s, r) => s + Number(r.profile_completion_pct || 0), 0) / rows.length
        : 0;
    const incomplete = rows.filter((r) => Number(r.profile_completion_pct || 0) < 70).length;
    return { active, avg, incomplete, total: rows.length };
  }, [rows]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return toast.error("No company context");
    setSaving(true);
    try {
      const created = await createEmployeeProfile({
        company_id: companyId,
        ...form,
        created_by: auth?.user?.id,
      });
      toast.success(`Profile ${created.employee_number} created`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const csv = exportProfilesCsv(
      filtered as unknown as Array<Record<string, unknown>>,
      [
        "employee_number",
        "first_name",
        "last_name",
        "email",
        "phone",
        "department",
        "job_title",
        "employment_type",
        "status",
        "profile_completion_pct",
      ]
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profiles-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  if (loading) return <LoadingState message="Loading digital employee profiles…" />;

  return (
    <div>
      <PageHeader
        title="Digital Employee Profiles"
        description="360° identity · HR · IAM · ID cards · payroll · skills · self-service"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/profiles/me"><UserCircle className="h-4 w-4 mr-1" /> My profile</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New profile</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreate}>
                  <DialogHeader><DialogTitle>Create employee profile</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
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
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Email</Label>
                        <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Department</Label>
                        <Input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Job title</Label>
                        <Input value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Employment type</Label>
                        <Select value={form.employment_type} onValueChange={(v) => setForm((f) => ({ ...f, employment_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {EMPLOYMENT_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Hire date</Label>
                        <Input type="date" value={form.hire_date} onChange={(e) => setForm((f) => ({ ...f, hire_date: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {PROFILE_LIFECYCLE.map((s) => (
          <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Total profiles" value={String(stats.total)} icon={Users} />
        <StatCard title="Active" value={String(stats.active)} icon={UserCircle} />
        <StatCard title="Avg completion" value={`${formatNumber(stats.avg)}%`} icon={BarChart3} />
        <StatCard title="Below 70%" value={String(stats.incomplete)} icon={FileText} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {MODULES.map((m) => (
          <Link
            key={m.href + m.title}
            href={m.href}
            className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <m.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{m.title}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Employee directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search name, ID, email, title…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No profiles" description="Create an employee profile or apply migration 00029." />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {r.first_name} {r.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">{r.employee_number}</div>
                      </TableCell>
                      <TableCell className="text-sm">{r.department || "—"}</TableCell>
                      <TableCell className="text-sm">{r.job_title || "—"}</TableCell>
                      <TableCell className="capitalize text-sm">{r.employment_type || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${Math.min(100, Number(r.profile_completion_pct || 0))}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums">{formatNumber(r.profile_completion_pct || 0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={r.status || "active"} /></TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/profiles/${r.id}`}>Open 360°</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
