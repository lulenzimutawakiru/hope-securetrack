"use client";

import { useEffect, useState } from "react";
import { UserCog } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

export default function IdentityRolesPage() {
  const [roles, setRoles] = useState<
    Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      is_system: boolean;
      perm_count?: number;
      user_count?: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("roles").select("*").order("name");
      const list = data ?? [];
      const enriched = await Promise.all(
        list.map(async (r) => {
          const [{ count: pc }, { count: uc }] = await Promise.all([
            supabase
              .from("role_permissions")
              .select("*", { count: "exact", head: true })
              .eq("role_id", r.id),
            supabase
              .from("user_profiles")
              .select("*", { count: "exact", head: true })
              .eq("role_id", r.id),
          ]);
          return {
            ...r,
            perm_count: pc ?? 0,
            user_count: uc ?? 0,
          };
        })
      );
      setRoles(enriched);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Roles (RBAC)"
        description="Super Admin · Finance · Sales · Manufacturing · Warehouse · Auditor · External roles"
      />

      {roles.length === 0 ? (
        <EmptyState icon={UserCog} title="No roles" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    {r.description && (
                      <div className="text-xs text-muted-foreground">
                        {r.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.slug}</TableCell>
                  <TableCell>{formatNumber(r.user_count || 0)}</TableCell>
                  <TableCell>{formatNumber(r.perm_count || 0)}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_system ? "secondary" : "outline"}>
                      {r.is_system ? "System" : "Custom"}
                    </Badge>
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
