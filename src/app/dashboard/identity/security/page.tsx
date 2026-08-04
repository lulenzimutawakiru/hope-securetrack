"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";

export default function IdentitySecurityPage() {
  const { auth } = useUser();
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([]);
  const [logins, setLogins] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const [{ data: a }, { data: l }] = await Promise.all([
      supabase
        .from("security_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("login_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setAlerts(a ?? []);
    setLogins(l ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resolve = async (id: string) => {
    if (!auth) return;
    const supabase = createClient();
    const crudRes = await crudUpdate("security_alerts", id, {
        status: "resolved",
        resolved_by: auth.profile.id,
        resolved_at: new Date().toISOString(),
      });
    toast.success("Alert resolved");
    load();
  };

  if (loading) return <LoadingState />;

  const openAlerts = alerts.filter((a) => a.status === "open").length;
  const failed = logins.filter((l) => !l.success).length;

  return (
    <div>
      <PageHeader
        title="Security Monitoring"
        description="Brute-force · failed logins · privilege alerts · login forensics"
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Open alerts" value={formatNumber(openAlerts)} icon={AlertTriangle} />
        <StatCard title="Login events" value={formatNumber(logins.length)} />
        <StatCard title="Failed (list)" value={formatNumber(failed)} />
      </div>

      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts">Security alerts</TabsTrigger>
          <TabsTrigger value="logins">Login history</TabsTrigger>
        </TabsList>
        <TabsContent value="alerts" className="mt-4">
          {alerts.length === 0 ? (
            <EmptyState title="No security alerts" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((a) => (
                    <TableRow key={String(a.id)}>
                      <TableCell className="text-xs">
                        {formatDateTime(String(a.created_at))}
                      </TableCell>
                      <TableCell className="text-xs capitalize">
                        {String(a.alert_type).replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {String(a.title)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={String(a.severity)} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={String(a.status)} />
                      </TableCell>
                      <TableCell className="text-right">
                        {a.status === "open" && (
                          <Button size="sm" onClick={() => resolve(String(a.id))}>
                            Resolve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="logins" className="mt-4">
          {logins.length === 0 ? (
            <EmptyState title="No login history yet" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logins.map((l) => (
                    <TableRow key={String(l.id)}>
                      <TableCell className="text-xs">
                        {formatDateTime(String(l.created_at))}
                      </TableCell>
                      <TableCell className="text-sm">{String(l.email || "—")}</TableCell>
                      <TableCell>
                        <StatusBadge status={l.success ? "approved" : "failed"} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {String(l.ip_address || "—")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {String(l.failure_reason || "—")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
