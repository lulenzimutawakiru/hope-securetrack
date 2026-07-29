"use client";

import { useEffect, useState } from "react";
import { UserCog, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { createCustomRole } from "@/lib/idm";

export default function IdentityRolesPage() {
  const { auth } = useUser();
  const [roles, setRoles] = useState<
    Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      is_system: boolean;
      role_category?: string | null;
      perm_count?: number;
      user_count?: number;
    }>
  >([]);
  const [permissions, setPermissions] = useState<Array<{ id: string; name: string; slug: string; module: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", slug: "", description: "", data_scope_default: "company" });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: perms }] = await Promise.all([
      supabase.from("roles").select("*").is("deleted_at", null).order("name"),
      supabase.from("permissions").select("id,name,slug,module").order("module").limit(500),
    ]);
    const list = data ?? [];
    const enriched = await Promise.all(
      list.map(async (r) => {
        const [{ count: pc }, { count: uc }] = await Promise.all([
          supabase.from("role_permissions").select("*", { count: "exact", head: true }).eq("role_id", r.id),
          supabase.from("user_profiles").select("*", { count: "exact", head: true }).eq("role_id", r.id),
        ]);
        return { ...r, perm_count: pc ?? 0, user_count: uc ?? 0 };
      })
    );
    setRoles(enriched);
    setPermissions((perms as typeof permissions) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await createCustomRole({
        company_id: companyId,
        name: form.name,
        slug: form.slug || form.name,
        description: form.description,
        permission_ids: selectedPerms,
        data_scope_default: form.data_scope_default,
        created_by: auth?.user?.id,
      });
      toast.success("Custom role created");
      setOpen(false);
      setSelectedPerms([]);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const togglePerm = (id: string) => {
    setSelectedPerms((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (loading) return <LoadingState message="Loading roles…" />;

  const custom = roles.filter((r) => !r.is_system || r.role_category === "custom").length;

  return (
    <div>
      <PageHeader
        title="Roles (RBAC) · Custom Builder"
        description="System roles · custom roles · permission mapping · data scope"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Custom role</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Create custom role</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} placeholder="Production Supervisor" />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input required value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Permissions ({selectedPerms.length} selected)</Label>
                    <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-1">
                      {permissions.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={selectedPerms.includes(p.id)}
                            onChange={() => togglePerm(p.id)}
                          />
                          <span className="font-mono">{p.slug}</span>
                          <span className="text-muted-foreground">{p.module}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Create role</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Roles" value={String(roles.length)} icon={UserCog} />
        <StatCard title="Custom / non-system" value={String(custom)} icon={UserCog} />
        <StatCard title="Permissions available" value={String(permissions.length)} icon={UserCog} />
      </div>

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
                    <div className="font-medium text-sm">{r.name}</div>
                    {r.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.slug}</TableCell>
                  <TableCell>{formatNumber(r.user_count || 0)}</TableCell>
                  <TableCell>{formatNumber(r.perm_count || 0)}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_system ? "outline" : "default"} className="text-[10px]">
                      {r.is_system ? "System" : r.role_category || "Custom"}
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
