"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

export default function AuditSessionsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await createClient()
      .from("eal_sessions")
      .select("*")
      .order("login_at", { ascending: false })
      .limit(100);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const terminate = async (id: string) => {
    await createClient()
      .from("eal_sessions")
      .update({
        status: "terminated",
        logout_at: new Date().toISOString(),
      })
      .eq("id", id);
    toast.success("Session terminated");
    await load();
  };

  if (loading) return <LoadingState message="Loading sessions…" />;

  return (
    <div>
      <PageHeader
        title="Session Security"
        description="Active sessions · MFA · device fingerprint · IP · risk · terminate"
      />

      {rows.length === 0 ? (
        <EmptyState title="No sessions" description="Login events populate session tracking." icon={ShieldCheck} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>MFA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell>
                    <p className="text-sm font-medium">{String(r.full_name || r.username)}</p>
                    <p className="text-xs text-muted-foreground font-mono">{String(r.session_id).slice(0, 16)}</p>
                  </TableCell>
                  <TableCell className="text-xs">{String(r.role_name || "—")}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.ip_address || "—")}</TableCell>
                  <TableCell>
                    <Badge variant={r.mfa_verified ? "default" : "outline"} className="text-[10px]">
                      {r.mfa_verified ? "Verified" : "None"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(String(r.login_at))}</TableCell>
                  <TableCell>{String(r.risk_score ?? 0)}</TableCell>
                  <TableCell className="text-right">
                    {r.status === "active" && (
                      <Button size="sm" variant="destructive" onClick={() => terminate(String(r.id))}>
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
