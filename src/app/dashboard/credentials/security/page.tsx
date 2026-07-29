"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, ScanLine, AlertTriangle, Printer, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function SecurityCentrePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    employees: 0,
    activeCards: 0,
    expired: 0,
    lost: 0,
    suspended: 0,
    accessEvents: 0,
    verifications: 0,
    failed: 0,
    prints: 0,
  });
  const [failedScans, setFailedScans] = useState<
    Array<{ id: string; result: string; qr_public_id: string | null; created_at: string; location_name: string | null }>
  >([]);
  const [recentAccess, setRecentAccess] = useState<
    Array<{ id: string; result: string; event_type: string; occurred_at: string; wid_identities?: { full_name: string } | null }>
  >([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [
        emp,
        active,
        expired,
        lost,
        susp,
        access,
        verif,
        failed,
        prints,
        { data: fails },
        { data: acc },
      ] = await Promise.all([
        supabase.from("wid_identities").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("wid_credentials").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("wid_credentials").select("*", { count: "exact", head: true }).eq("status", "expired"),
        supabase.from("wid_credentials").select("*", { count: "exact", head: true }).in("status", ["lost", "stolen"]),
        supabase.from("wid_credentials").select("*", { count: "exact", head: true }).eq("status", "suspended"),
        supabase.from("wid_access_events").select("*", { count: "exact", head: true }),
        supabase.from("wid_verification_logs").select("*", { count: "exact", head: true }),
        supabase
          .from("wid_verification_logs")
          .select("*", { count: "exact", head: true })
          .in("result", ["not_found", "revoked", "suspended", "suspicious", "invalid_token", "expired"]),
        supabase.from("wid_print_jobs").select("*", { count: "exact", head: true }),
        supabase
          .from("wid_verification_logs")
          .select("id,result,qr_public_id,created_at,location_name")
          .in("result", ["not_found", "revoked", "suspended", "suspicious", "invalid_token", "expired"])
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("wid_access_events")
          .select("id,result,event_type,occurred_at,wid_identities(full_name)")
          .order("occurred_at", { ascending: false })
          .limit(15),
      ]);
      setStats({
        employees: emp.count ?? 0,
        activeCards: active.count ?? 0,
        expired: expired.count ?? 0,
        lost: lost.count ?? 0,
        suspended: susp.count ?? 0,
        accessEvents: access.count ?? 0,
        verifications: verif.count ?? 0,
        failed: failed.count ?? 0,
        prints: prints.count ?? 0,
      });
      setFailedScans(fails ?? []);
      setRecentAccess((acc as unknown as typeof recentAccess) ?? []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading security centre…" />;

  return (
    <div>
      <PageHeader
        title="Admin Security Centre"
        description="Identity posture · failed scans · access anomalies · print activity"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-8">
        <StatCard title="Identities" value={String(stats.employees)} icon={ShieldAlert} />
        <StatCard title="Active cards" value={String(stats.activeCards)} icon={CreditCard} />
        <StatCard title="Expired" value={String(stats.expired)} icon={AlertTriangle} />
        <StatCard title="Lost / stolen" value={String(stats.lost)} icon={AlertTriangle} />
        <StatCard title="Suspended" value={String(stats.suspended)} icon={ShieldAlert} />
        <StatCard title="Access events" value={String(stats.accessEvents)} icon={ScanLine} />
        <StatCard title="Verifications" value={String(stats.verifications)} icon={ScanLine} />
        <StatCard title="Failed scans" value={String(stats.failed)} icon={AlertTriangle} />
        <StatCard title="Print jobs" value={String(stats.prints)} icon={Printer} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Failed / suspicious verifications</CardTitle>
          </CardHeader>
          <CardContent>
            {failedScans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failed scans recorded.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>QR</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedScans.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-xs">{new Date(f.created_at).toLocaleString()}</TableCell>
                      <TableCell><StatusBadge status={f.result} /></TableCell>
                      <TableCell className="font-mono text-xs">{f.qr_public_id || "—"}</TableCell>
                      <TableCell className="text-xs">{f.location_name || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent access events</CardTitle>
          </CardHeader>
          <CardContent>
            {recentAccess.length === 0 ? (
              <p className="text-sm text-muted-foreground">No access events yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Person</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentAccess.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">{new Date(a.occurred_at).toLocaleString()}</TableCell>
                      <TableCell>{a.wid_identities?.full_name || "—"}</TableCell>
                      <TableCell className="text-xs">{a.event_type}</TableCell>
                      <TableCell>
                        <Badge variant={a.result === "granted" ? "default" : "destructive"}>{a.result}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
