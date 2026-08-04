"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, Search, KeyRound, Lock, Unlock, UserX, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { updateAccountStatus, forcePasswordReset, assignRoles } from "@/lib/idm";

interface UserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  username: string | null;
  employee_id: string | null;
  is_active: boolean;
  user_type: string | null;
  account_status: string | null;
  lifecycle_status: string | null;
  job_title: string | null;
  department?: string | null;
  mfa_enabled: boolean | null;
  mfa_enforced: boolean | null;
  require_mfa: boolean | null;
  failed_login_count: number | null;
  locked_until: string | null;
  last_login_at: string | null;
  last_login_device: string | null;
  role_id: string;
  roles?: { name: string; slug: string } | null;
}

interface Role {
  id: string;
  name: string;
  slug: string;
}

export default function IdentityUsersPage() {
  const { auth } = useUser();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [tempPw, setTempPw] = useState<string | null>(null);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: r }] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("*, roles!user_profiles_role_id_fkey(name, slug)")
        .is("deleted_at", null)
        .order("last_name")
        .limit(500),
      supabase.from("roles").select("id,name,slug").order("name"),
    ]);
    setUsers((data as UserRow[]) ?? []);
    setRoles((r as Role[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = users;
    if (statusFilter !== "all") {
      list = list.filter((u) => (u.account_status || (u.is_active ? "active" : "suspended")) === statusFilter);
    }
    const s = search.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (u) =>
        u.first_name?.toLowerCase().includes(s) ||
        u.last_name?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s) ||
        u.username?.toLowerCase().includes(s) ||
        u.employee_id?.toLowerCase().includes(s) ||
        u.job_title?.toLowerCase().includes(s) ||
        u.roles?.name?.toLowerCase().includes(s)
    );
  }, [users, search, statusFilter]);

  const stats = useMemo(() => {
    const active = users.filter((u) => u.is_active).length;
    const locked = users.filter((u) => u.account_status === "locked" || u.locked_until).length;
    const mfa = users.filter((u) => u.mfa_enabled || u.require_mfa || u.mfa_enforced).length;
    return { active, locked, mfa, total: users.length };
  }, [users]);

  const setStatus = async (id: string, account_status: string) => {
    if (!companyId) return;
    try {
      await updateAccountStatus({
        user_id: id,
        company_id: companyId,
        account_status,
        actor_id: auth?.user?.id,
      });
      toast.success(`Status → ${account_status}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const resetPw = async (id: string) => {
    if (!companyId) return;
    try {
      const res = await forcePasswordReset({
        company_id: companyId,
        user_id: id,
        actor_id: auth?.user?.id,
      });
      setTempPw(res.temp_password);
      toast.success("Temporary password generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed — check service role key");
    }
  };

  const changeRole = async (userId: string, newRoleId: string) => {
    if (!companyId) return;
    try {
      await assignRoles({
        company_id: companyId,
        user_id: userId,
        role_ids: [newRoleId],
        primary_role_id: newRoleId,
        actor_id: auth?.user?.id,
      });
      toast.success("Role updated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading user directory…" />;

  return (
    <div>
      <PageHeader
        title="User Directory"
        description="Enterprise directory · status · roles · MFA · last login · password reset"
        actions={
          <Button asChild size="sm">
            <Link href="/dashboard/identity/create">Create account</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Users" value={String(stats.total)} icon={Users} />
        <StatCard title="Active" value={String(stats.active)} icon={UserCheck} />
        <StatCard title="Locked" value={String(stats.locked)} icon={Lock} />
        <StatCard title="MFA flagged" value={String(stats.mfa)} icon={KeyRound} />
      </div>

      {tempPw && (
        <Card className="mb-4 border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4 text-sm">
            Temporary password: <code className="font-mono">{tempPw}</code>
            <Button size="sm" variant="ghost" className="ml-2" onClick={() => setTempPw(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Name, email, username, employee ID, role…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["active", "pending_activation", "suspended", "locked", "disabled", "expired"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No users" description="Provision accounts or apply migration 00031." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>MFA</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {u.first_name?.[0]}{u.last_name?.[0]}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{u.first_name} {u.last_name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                        {u.employee_id && <div className="text-[10px] font-mono">{u.employee_id}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{u.username || "—"}</TableCell>
                  <TableCell className="capitalize text-sm">{u.user_type || "employee"}</TableCell>
                  <TableCell>
                    <Select value={u.role_id} onValueChange={(v) => changeRole(u.id, v)}>
                      <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={u.account_status || (u.is_active ? "active" : "suspended")} />
                  </TableCell>
                  <TableCell>
                    {u.mfa_enabled || u.require_mfa || u.mfa_enforced ? (
                      <Badge variant="outline" className="text-[10px]">Required</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Off</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {u.last_login_at ? formatDateTime(u.last_login_at) : "Never"}
                    {u.last_login_device && (
                      <div className="text-muted-foreground truncate max-w-[100px]">{u.last_login_device}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {u.is_active ? (
                        <Button size="icon" variant="ghost" title="Suspend" onClick={() => setStatus(u.id, "suspended")}>
                          <UserX className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" title="Activate" onClick={() => setStatus(u.id, "active")}>
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                      {u.locked_until || u.account_status === "locked" ? (
                        <Button size="icon" variant="ghost" title="Unlock" onClick={() => setStatus(u.id, "active")}>
                          <Unlock className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" title="Lock" onClick={() => setStatus(u.id, "locked")}>
                          <Lock className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" title="Reset password" onClick={() => resetPw(u.id)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/identity/users/${u.id}`}>Profile</Link>
                      </Button>
                    </div>
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
