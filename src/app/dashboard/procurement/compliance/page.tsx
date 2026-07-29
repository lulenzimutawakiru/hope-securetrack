"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { getComplianceDashboard, resolveComplianceItem } from "@/lib/srm";
import { toast } from "sonner";

export default function SrmCompliancePage() {
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<Awaited<ReturnType<typeof getComplianceDashboard>> | null>(null);

  const load = async () => {
    try {
      setDash(await getComplianceDashboard());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading || !dash) return <LoadingState message="Loading compliance…" />;

  return (
    <div>
      <PageHeader
        title="Supplier Compliance Dashboard"
        description="Certifications · CAPA · contracts · delays · quality trends · financial exposure · ESG"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement/documents">Documents</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement/quality">Quality</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StatCard title="Open compliance items" value={String(dash.openCompliance)} icon={ShieldCheck} />
        <StatCard title="Overdue" value={String(dash.overdue)} icon={AlertTriangle} />
        <StatCard title="Certs expiring ≤60d" value={String(dash.expiringCerts)} />
        <StatCard title="Contracts expiring ≤90d" value={String(dash.expiringContracts)} />
        <StatCard title="Open CAPAs / NCRs" value={String(dash.openCapas)} />
        <StatCard title="Open risks" value={String(dash.openRisks)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dash.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      No open compliance items
                    </TableCell>
                  </TableRow>
                ) : (
                  dash.items.map((i) => (
                    <TableRow key={String(i.id)}>
                      <TableCell>
                        <p className="font-medium text-sm">{String(i.title)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(i.suppliers as { name?: string } | null)?.name || "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {String(i.item_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {i.due_date ? String(i.due_date).slice(0, 10) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={String(i.status)} />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() =>
                            resolveComplianceItem(String(i.id))
                              .then(() => {
                                toast.success("Resolved");
                                load();
                              })
                              .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                          }
                        >
                          Resolve
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expiring certifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dash.certs.length === 0 && (
                <p className="text-sm text-muted-foreground">No certificates expiring soon</p>
              )}
              {dash.certs.map((c) => (
                <div key={String(c.id)} className="flex justify-between text-sm border-b last:border-0 pb-2">
                  <span className="truncate max-w-[70%]">{String(c.title)}</span>
                  <Badge variant="destructive" className="text-[10px]">
                    {c.expires_at ? String(c.expires_at).slice(0, 10) : "—"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contract expirations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dash.contracts.length === 0 && (
                <p className="text-sm text-muted-foreground">No contracts in 90-day window</p>
              )}
              {dash.contracts.map((c) => (
                <div key={String(c.id)} className="flex justify-between text-sm border-b last:border-0 pb-2">
                  <span className="truncate max-w-[70%] font-medium">{String(c.title)}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.end_date ? String(c.end_date).slice(0, 10) : "—"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
