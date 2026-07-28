"use client";

import { useEffect, useState } from "react";
import { Users, Search } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

interface UserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_id: string | null;
  is_active: boolean;
  user_kind: string | null;
  lifecycle_status: string | null;
  job_title: string | null;
  mfa_enabled: boolean | null;
  mfa_enforced: boolean | null;
  failed_login_count: number | null;
  locked_until: string | null;
  last_login_at: string | null;
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
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: r }] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("*, roles(name, slug)")
        .order("last_name"),
      supabase.from("roles").select("id,name,slug").order("name"),
    ]);
    setUsers((data as UserRow[]) ?? []);
    setRoles((r as Role[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setActive = async (id: string, is_active: boolean) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("user_profiles")
      .update({
        is_active,
        lifecycle_status: is_active ? "active" : "suspended",
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(is_active ? "User activated" : "User suspended");
      load();
    }
  };

  const unlock = async (id: string) => {
    const supabase = createClient();
    await supabase
      .from("user_profiles")
      .update({ locked_until: null, failed_login_count: 0 })
      .eq("id", id);
    toast.success("Account unlocked");
    load();
  };

  const changeRole = async (userId: string, newRoleId: string, oldRoleId: string) => {
    if (!auth) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("user_profiles")
      .update({ role_id: newRoleId })
      .eq("id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("user_role_changes").insert({
      company_id: auth.profile.company_id,
      user_id: userId,
      old_role_id: oldRoleId,
      new_role_id: newRoleId,
      changed_by: auth.profile.id,
      reason: "Admin role change",
    });
    toast.success("Role updated");
    load();
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q) ||
      (u.employee_id || "").toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="User Directory"
        description="Internal & external identities · lifecycle · role assignment · lockout recovery"
      />

      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No users found" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead>MFA</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const locked =
                  u.locked_until && new Date(u.locked_until) > new Date();
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">
                        {u.first_name} {u.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                      {u.employee_id && (
                        <div className="text-[10px] font-mono">{u.employee_id}</div>
                      )}
                    </TableCell>
                    <TableCell className="capitalize text-xs">
                      {(u.user_kind || "internal").replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role_id}
                        onValueChange={(v) => changeRole(u.id, v, u.role_id)}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={
                          locked
                            ? "blocked"
                            : u.is_active
                              ? u.lifecycle_status || "active"
                              : "suspended"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {u.mfa_enabled || u.mfa_enforced ? (
                        <Badge variant="default">On</Badge>
                      ) : (
                        <Badge variant="outline">Off</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.last_login_at ? formatDateTime(u.last_login_at) : "Never"}
                      {(u.failed_login_count || 0) > 0 && (
                        <div className="text-amber-600">
                          Fails: {u.failed_login_count}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {locked && (
                        <Button size="sm" variant="outline" onClick={() => unlock(u.id)}>
                          Unlock
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={u.is_active ? "outline" : "default"}
                        onClick={() => setActive(u.id, !u.is_active)}
                      >
                        {u.is_active ? "Suspend" : "Activate"}
                      </Button>
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
