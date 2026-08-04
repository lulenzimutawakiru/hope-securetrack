"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Users, CreditCard, Ban, RefreshCw } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import {
  IDENTITY_TYPES,
  createIdentityWithNumber,
  issueCredential,
  terminateIdentity,
  type WidIdentity,
} from "@/lib/workforce-id";

export default function IdentitiesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<WidIdentity[]>([]);
  const [employees, setEmployees] = useState<
    Array<{ id: string; employee_number: string; first_name: string; last_name: string; department: string | null; job_title: string | null; email: string | null }>
  >([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; template_code: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    employee_id: "",
    identity_type: "employee",
    full_name: "",
    email: "",
    phone: "",
    department: "Production",
    job_title: "",
    employment_type: "permanent",
    security_clearance: "standard",
    hire_date: new Date().toISOString().slice(0, 10),
    expiry_date: "",
    issue_card: true,
    with_rfid: false,
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: ids }, { data: emps }, { data: tpls }] = await Promise.all([
      supabase
        .from("wid_identities")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("employees")
        .select("id,employee_number,first_name,last_name,department,job_title,email")
        .eq("status", "active")
        .order("last_name")
        .limit(300),
      supabase
        .from("wid_card_templates")
        .select("id,name,template_code")
        .eq("is_active", true)
        .is("deleted_at", null),
    ]);
    setRows((ids as WidIdentity[]) ?? []);
    setEmployees(emps ?? []);
    setTemplates(tpls ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const onEmployeePick = (id: string) => {
    const e = employees.find((x) => x.id === id);
    if (!e) {
      setForm((f) => ({ ...f, employee_id: id }));
      return;
    }
    setForm((f) => ({
      ...f,
      employee_id: id,
      full_name: `${e.first_name} ${e.last_name}`.trim(),
      email: e.email || "",
      department: e.department || f.department,
      job_title: e.job_title || "",
    }));
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    if (!form.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const identity = await createIdentityWithNumber(supabase, {
        company_id: auth.profile.company_id,
        employee_id: form.employee_id || null,
        identity_type: form.identity_type,
        full_name: form.full_name.trim(),
        email: form.email || undefined,
        phone: form.phone || undefined,
        department: form.department || undefined,
        job_title: form.job_title || undefined,
        employment_type: form.employment_type,
        security_clearance: form.security_clearance,
        hire_date: form.hire_date || undefined,
        expiry_date: form.expiry_date || undefined,
        created_by: auth.profile.id,
      });

      if (form.issue_card) {
        const tpl =
          templates.find((t) =>
            form.identity_type.includes("security")
              ? t.template_code === "TPL-SEC"
              : form.identity_type === "visitor"
                ? t.template_code === "TPL-VIS"
                : form.department.toLowerCase().includes("production")
                  ? t.template_code === "TPL-FACT"
                  : t.template_code === "TPL-EXEC"
          ) || templates[0];

        await issueCredential(supabase, {
          company_id: auth.profile.company_id,
          identity_id: identity.id,
          template_id: tpl?.id,
          credential_type: form.with_rfid ? "rfid" : "pvc",
          expiry_date: form.expiry_date || null,
          with_rfid: form.with_rfid,
          with_nfc: form.with_rfid,
          created_by: auth.profile.id,
          auto_queue_print: true,
        });
      }

      toast.success(`Identity ${identity.identity_number} created`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const terminate = async (id: string) => {
    if (!confirm("Terminate identity, disable all cards, and revoke access?")) return;
    try {
      const supabase = createClient();
      await terminateIdentity(supabase, id);
      toast.success("Identity terminated and access revoked");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terminate failed");
    }
  };

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.full_name.toLowerCase().includes(s) ||
      r.identity_number.toLowerCase().includes(s) ||
      (r.department || "").toLowerCase().includes(s) ||
      (r.email || "").toLowerCase().includes(s)
    );
  });

  if (loading) return <LoadingState message="Loading identities…" />;

  const active = rows.filter((r) => r.status === "active").length;

  return (
    <div>
      <PageHeader
        title="Workforce Identities"
        description="Employee · contractor · operator · visitor — multi-identity lifecycle"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => load()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> New Identity
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create workforce identity</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div>
                    <Label>Link HR employee (optional)</Label>
                    <Select value={form.employee_id || "_none"} onValueChange={(v) => onEmployeePick(v === "_none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— Manual entry —</SelectItem>
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.employee_number} · {e.first_name} {e.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Identity type</Label>
                    <Select value={form.identity_type} onValueChange={(v) => setForm((f) => ({ ...f, identity_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {IDENTITY_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.group}: {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Full name *</Label>
                    <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Email</Label>
                      <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
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
                          {["permanent", "temporary", "contract", "intern", "consultant"].map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Clearance</Label>
                      <Select value={form.security_clearance} onValueChange={(v) => setForm((f) => ({ ...f, security_clearance: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["standard", "confidential", "secret", "top_secret"].map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Hire date</Label>
                      <Input type="date" value={form.hire_date} onChange={(e) => setForm((f) => ({ ...f, hire_date: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Expiry (optional)</Label>
                      <Input type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.issue_card} onChange={(e) => setForm((f) => ({ ...f, issue_card: e.target.checked }))} />
                    Issue credential + queue print + auto access
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.with_rfid} onChange={(e) => setForm((f) => ({ ...f, with_rfid: e.target.checked }))} />
                    RFID / NFC smart badge
                  </label>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Total" value={String(rows.length)} icon={Users} />
        <StatCard title="Active" value={String(active)} icon={CreditCard} />
        <StatCard title="Terminated" value={String(rows.filter((r) => r.status === "terminated").length)} icon={Ban} />
      </div>

      <div className="mb-4">
        <Input placeholder="Search name, ID, department…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No identities" description="Create a workforce identity or sync from HR employees." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identity #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Clearance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.identity_number}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">{r.job_title || "—"}</div>
                  </TableCell>
                  <TableCell className="text-xs">{r.identity_type}</TableCell>
                  <TableCell>{r.department || "—"}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-xs">{r.security_clearance || "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/credentials/cards?identity=${r.id}`}>Cards</Link>
                    </Button>
                    {r.status !== "terminated" && (
                      <Button size="sm" variant="ghost" onClick={() => terminate(r.id)}>
                        Terminate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
