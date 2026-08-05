"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, RefreshCw, Search, Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";

type UserRow = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  tenant_id?: string | null;
  is_active?: boolean;
  is_platform_admin?: boolean;
  mfa_enabled?: boolean;
  require_mfa?: boolean;
  roles?: { slug?: string; name?: string } | null;
  tenants?: { name?: string; slug?: string } | null;
};

type UserAction =
  | "deactivate"
  | "activate"
  | "require_mfa"
  | "clear_require_mfa"
  | "force_logout";

export default function PlatformUsersPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      qs.set("limit", "300");
      const res = await fetch(`/api/platform/users?${qs}`);
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Failed to load users");
      }
      setRows(json.data?.users ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (user_id: string, action: UserAction) => {
    setBusyId(user_id);
    try {
      const res = await fetch("/api/platform/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id,
          action,
          reason: `Platform user admin: ${action}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Action failed");
      }
      toast.success(json.data?.message || action);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  if (loading && rows.length === 0) {
    return <LoadingState message="Loading estate users..." />;
  }

  return (
    <div>
      <PageHeader
        title="User Administration"
        description="Enterprise identity — users, MFA, deactivate, force logout across the estate"
        actions={
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        }
      />

      <p className="text-xs text-muted-foreground mb-3">
        Roles, groups, teams, and departments are managed in ERP Identity for
        each tenant. Platform staff can deactivate users, require MFA, and force
        logout here. Password reset uses Supabase recovery from ERP login.
      </p>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <Button variant="secondary" onClick={load}>
          Search
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>MFA</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <p className="font-medium text-sm">
                    {u.first_name} {u.last_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{u.email}</p>
                </TableCell>
                <TableCell>
                  {u.tenant_id ? (
                    <Link
                      href={`/platform/tenants/${u.tenant_id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {u.tenants?.name || u.tenants?.slug || "Tenant"}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Platform staff
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {u.roles?.name || u.roles?.slug || "-"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      u.mfa_enabled || u.require_mfa ? "secondary" : "outline"
                    }
                    className="text-[10px]"
                  >
                    {u.mfa_enabled
                      ? "enabled"
                      : u.require_mfa
                        ? "required"
                        : "off"}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-1">
                  {u.is_platform_admin ? (
                    <Badge className="text-[10px]">platform admin</Badge>
                  ) : null}
                  {u.is_active === false ? (
                    <Badge variant="outline" className="text-[10px]">
                      inactive
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1 flex-wrap">
                    {u.is_active === false ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === u.id}
                        onClick={() => act(u.id, "activate")}
                      >
                        Activate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === u.id}
                        onClick={() => act(u.id, "deactivate")}
                      >
                        Deactivate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === u.id}
                      onClick={() =>
                        act(
                          u.id,
                          u.require_mfa ? "clear_require_mfa" : "require_mfa"
                        )
                      }
                    >
                      {u.require_mfa ? "MFA optional" : "Require MFA"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === u.id}
                      onClick={() => act(u.id, "force_logout")}
                    >
                      Force logout
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-muted-foreground py-10"
                >
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
