"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  UserCircle, FileText, CalendarDays, Wallet, GraduationCap,
  Laptop, LifeBuoy, IdCard, Plus,
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
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import {
  createProfileRequest,
  REQUEST_TYPES,
  loadProfile360,
  type EmployeeProfile,
} from "@/lib/profile";

export default function MyProfilePage() {
  const { auth } = useUser();
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadProfile360>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [reqOpen, setReqOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    request_type: "profile_update",
    title: "",
    description: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      if (!auth?.user?.id) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      let { data: emp } = await supabase
        .from("employees")
        .select("*")
        .eq("user_id", auth.user.id)
        .is("deleted_at", null)
        .maybeSingle();

      // Fallback: match by email
      if (!emp && auth.profile?.email) {
        const { data: byEmail } = await supabase
          .from("employees")
          .select("*")
          .eq("email", auth.profile.email)
          .is("deleted_at", null)
          .maybeSingle();
        emp = byEmail;
      }

      if (emp) {
        setEmployee(emp as EmployeeProfile);
        const full = await loadProfile360(emp.id);
        setBundle(full);
      }
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [auth]);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !employee) return toast.error("No employee profile linked");
    setSaving(true);
    try {
      const req = await createProfileRequest({
        company_id: companyId,
        employee_id: employee.id,
        request_type: form.request_type,
        title: form.title,
        description: form.description,
      });
      toast.success(`Request ${req.request_number} submitted`);
      setReqOpen(false);
      const full = await loadProfile360(employee.id);
      setBundle(full);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading self-service portal…" />;

  if (!employee) {
    return (
      <div>
        <PageHeader title="My Profile" description="Employee self-service" />
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No employee record is linked to your user account ({auth?.profile?.email}).
            Ask HR to link your profile, or open the{" "}
            <Link href="/dashboard/profiles" className="underline">directory</Link>.
          </CardContent>
        </Card>
      </div>
    );
  }

  const pct = Number(employee.profile_completion_pct || 0);

  return (
    <div>
      <PageHeader
        title="My Profile · Self-Service"
        description="Update personal details · documents · leave · ID · assets · tickets"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/profiles/${employee.id}`}>Full 360° view</Link>
            </Button>
            <Dialog open={reqOpen} onOpenChange={setReqOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New request</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submitRequest}>
                  <DialogHeader><DialogTitle>Self-service request</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Type</Label>
                      <Select value={form.request_type} onValueChange={(v) => setForm((f) => ({ ...f, request_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REQUEST_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                {employee.first_name?.[0]}{employee.last_name?.[0]}
              </div>
              <div>
                <div className="font-semibold">{employee.first_name} {employee.last_name}</div>
                <div className="text-xs text-muted-foreground font-mono">{employee.employee_number}</div>
                <div className="text-sm text-muted-foreground">{employee.job_title}</div>
              </div>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span>Profile completion</span>
              <span>{formatNumber(pct)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { href: `/dashboard/profiles/${employee.id}`, icon: UserCircle, label: "View profile" },
              { href: "/dashboard/hr/leave", icon: CalendarDays, label: "Leave" },
              { href: "/dashboard/hr/payroll", icon: Wallet, label: "Payslips" },
              { href: "/dashboard/hr/training", icon: GraduationCap, label: "Training" },
              { href: "/dashboard/credentials", icon: IdCard, label: "Digital ID" },
              { href: "/dashboard/profiles/documents", icon: FileText, label: "Documents" },
              { href: "/dashboard/profiles/me", icon: Laptop, label: "My assets" },
              { href: "/dashboard/profiles/requests", icon: LifeBuoy, label: "Support" },
            ].map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex flex-col items-center gap-1 rounded-lg border p-3 hover:bg-muted/40 text-center"
              >
                <a.icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">{a.label}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">My requests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(bundle?.requests || []).slice(0, 8).map((r: Record<string, unknown>) => (
              <div key={String(r.id)} className="flex justify-between items-center border-b py-2 text-sm last:border-0">
                <div>
                  <div className="font-medium">{String(r.title)}</div>
                  <div className="text-xs text-muted-foreground font-mono">{String(r.request_number)}</div>
                </div>
                <Badge variant="outline" className="capitalize">{String(r.status)}</Badge>
              </div>
            ))}
            {(bundle?.requests || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No requests yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Assigned assets</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(bundle?.assets || []).map((a: Record<string, unknown>) => (
              <div key={String(a.id)} className="flex justify-between text-sm border-b py-2 last:border-0">
                <span>{String(a.description)}</span>
                <Badge variant="outline">{String(a.status)}</Badge>
              </div>
            ))}
            {(bundle?.assets || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No assets assigned.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
