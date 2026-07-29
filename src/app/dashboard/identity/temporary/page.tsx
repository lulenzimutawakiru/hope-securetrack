"use client";

import { useEffect, useState } from "react";
import { Clock, Plus, Ban } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { createTempAccess, revokeTempAccess } from "@/lib/idm";

export default function TemporaryAccessPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    visitor_name: "",
    visitor_email: "",
    access_type: "contractor",
    role_id: "",
    start_at: new Date().toISOString().slice(0, 16),
    end_at: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 16),
    reason: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: u }, { data: r }] = await Promise.all([
      supabase.from("idm_temp_access").select("*, user_profiles(first_name,last_name), roles(name)").order("created_at", { ascending: false }),
      supabase.from("user_profiles").select("id,first_name,last_name").limit(100),
      supabase.from("roles").select("id,name").eq("is_active", true),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setUsers((u as typeof users) || []);
    setRoles((r as typeof roles) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await createTempAccess({
        company_id: companyId,
        user_id: form.user_id || null,
        visitor_name: form.visitor_name || undefined,
        visitor_email: form.visitor_email || undefined,
        access_type: form.access_type,
        role_id: form.role_id || null,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
        reason: form.reason,
        sponsor_user_id: auth?.user?.id,
        created_by: auth?.user?.id,
      });
      toast.success("Temporary access granted");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading temporary access…" />;

  const active = rows.filter((r) => r.status === "active").length;
  const expiring = rows.filter((r) => {
    if (!r.end_at || r.status === "revoked" || r.status === "expired") return false;
    const d = new Date(String(r.end_at)).getTime() - Date.now();
    return d > 0 && d < 3 * 864e5;
  }).length;

  return (
    <div>
      <PageHeader
        title="Temporary Access"
        description="Contractors · auditors · visitors · auto-expiry · revoke"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Grant access</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Temporary access grant</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Existing user (optional)</Label>
                    <Select value={form.user_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, user_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Visitor only</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Visitor name</Label>
                      <Input value={form.visitor_name} onChange={(e) => setForm((f) => ({ ...f, visitor_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Visitor email</Label>
                      <Input value={form.visitor_email} onChange={(e) => setForm((f) => ({ ...f, visitor_email: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Access type</Label>
                    <Select value={form.access_type} onValueChange={(v) => setForm((f) => ({ ...f, access_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["contractor", "auditor", "visitor", "temporary", "guest"].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={form.role_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, role_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Start</Label>
                      <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))} />
                    </div>
                    <div>
                      <Label>End</Label>
                      <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Reason</Label>
                    <Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Grant</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Grants" value={String(rows.length)} icon={Clock} />
        <StatCard title="Active" value={String(active)} icon={Clock} />
        <StatCard title="Expiring ≤ 3d" value={String(expiring)} icon={Clock} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No temporary grants" description="Issue time-bound access for contractors and auditors." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grant</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const u = r.user_profiles as { first_name?: string; last_name?: string } | null;
                const role = r.roles as { name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">{String(r.grant_number)}</TableCell>
                    <TableCell className="text-sm">
                      {u ? `${u.first_name} ${u.last_name}` : String(r.visitor_name || r.visitor_email || "—")}
                      {role?.name && <div className="text-xs text-muted-foreground">{role.name}</div>}
                    </TableCell>
                    <TableCell className="capitalize text-sm">{String(r.access_type)}</TableCell>
                    <TableCell className="text-xs">
                      {r.start_at ? formatDateTime(String(r.start_at)) : "—"}
                      <br />→ {r.end_at ? formatDateTime(String(r.end_at)) : "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                    <TableCell>
                      {(r.status === "active" || r.status === "scheduled") && companyId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await revokeTempAccess(String(r.id), companyId, auth?.user?.id);
                            toast.success("Revoked");
                            await load();
                          }}
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" /> Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
