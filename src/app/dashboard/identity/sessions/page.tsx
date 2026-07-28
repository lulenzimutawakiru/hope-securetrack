"use client";

import { useEffect, useState } from "react";
import { MonitorSmartphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

export default function IdentitySessionsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("user_sessions")
      .select("*, user_profiles(first_name,last_name,email)")
      .eq("is_active", true)
      .order("last_seen_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const revoke = async (id: string) => {
    if (!auth) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("user_sessions")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: auth.profile.id,
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Session revoked");
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Session Management"
        description="Active sessions · device / IP · remote termination"
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={MonitorSmartphone}
          title="No tracked sessions"
          description="Sessions appear when clients register after login"
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const u = r.user_profiles as {
                  first_name: string;
                  last_name: string;
                  email: string;
                } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell>
                      <div className="font-medium">
                        {u
                          ? `${u.first_name} ${u.last_name}`
                          : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {u?.email}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate">
                      {String(r.device_label || r.user_agent || "—").slice(0, 80)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {String(r.ip_address || "—")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.last_seen_at
                        ? formatDateTime(String(r.last_seen_at))
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.is_active ? "default" : "outline"}>
                        {r.is_active ? "Active" : "Revoked"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.is_active ? (
                        <Button size="sm" variant="outline" onClick={() => revoke(String(r.id))}>
                          Revoke
                        </Button>
                      ) : null}
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
