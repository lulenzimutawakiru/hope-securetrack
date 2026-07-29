"use client";

import { useEffect, useState } from "react";
import { MonitorSmartphone, LogOut, Ban } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { terminateAllUserSessions } from "@/lib/idm";

export default function IdentitySessionsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    let q = supabase
      .from("user_sessions")
      .select("*, user_profiles(first_name,last_name,email)")
      .order("last_seen_at", { ascending: false })
      .limit(200);
    if (!showAll) q = q.eq("is_active", true);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [showAll]);

  const revoke = async (id: string) => {
    if (!auth) return;
    const { error } = await createClient()
      .from("user_sessions")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: auth.profile.id,
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Session terminated");
      await load();
    }
  };

  const logoutUser = async (userId: string) => {
    if (!companyId || !auth) return;
    try {
      await terminateAllUserSessions({
        user_id: userId,
        actor_id: auth.user.id,
        company_id: companyId,
      });
      toast.success("All sessions for user terminated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading sessions…" />;

  const active = rows.filter((r) => r.is_active).length;
  const devices = new Set(rows.map((r) => String(r.device_label || r.user_agent || ""))).size;

  return (
    <div>
      <PageHeader
        title="Session Management"
        description="Active sessions · devices · IP · location · remote logout · terminate"
        actions={
          <Button size="sm" variant="outline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Active only" : "Show history"}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Sessions shown" value={String(rows.length)} icon={MonitorSmartphone} />
        <StatCard title="Active" value={String(active)} icon={MonitorSmartphone} />
        <StatCard title="Distinct devices" value={String(devices)} icon={MonitorSmartphone} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={MonitorSmartphone}
          title="No tracked sessions"
          description="Sessions appear when clients register after login"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const u = r.user_profiles as {
                  first_name?: string;
                  last_name?: string;
                  email?: string;
                } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="text-sm">
                      <div className="font-medium">
                        {u ? `${u.first_name} ${u.last_name}` : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">{u?.email}</div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[160px] truncate">
                      {String(r.device_label || r.user_agent || "—").slice(0, 50)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{String(r.ip_address || "—")}</TableCell>
                    <TableCell className="text-xs">
                      {String(r.location_name || r.location_hint || "—")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.last_seen_at ? formatDateTime(String(r.last_seen_at)) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.is_active ? "default" : "outline"}>
                        {r.is_active ? "Active" : "Ended"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {Boolean(r.is_active) && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => revoke(String(r.id))}>
                            <LogOut className="h-3.5 w-3.5 mr-1" /> End
                          </Button>
                          {Boolean(r.user_id) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Logout all devices"
                              onClick={() => logoutUser(String(r.user_id))}
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </>
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
