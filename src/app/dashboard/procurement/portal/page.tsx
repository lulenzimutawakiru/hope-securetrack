"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe, Key } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { listSuppliers, listPortalRequests, enableSupplierPortal } from "@/lib/srm";
import { toast } from "sonner";

export default function SrmPortalPage() {
  const { auth } = useUser();
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [s, r] = await Promise.all([listSuppliers({ limit: 100 }), listPortalRequests()]);
      setSuppliers(s);
      setRequests(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const enable = async (id: string) => {
    if (!auth) return;
    try {
      await enableSupplierPortal(id, auth.profile.company_id);
      toast.success("Supplier portal enabled");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading supplier portal…" />;

  const enabled = suppliers.filter((s) => s.portal_enabled);

  return (
    <div>
      <PageHeader
        title="Supplier Self-Service Portal"
        description="Profiles · RFQs · POs · deliveries · invoices · payments · contracts · HopeChat"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/procurement">Hub</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Portal-enabled</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> {enabled.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Open requests</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">
            {requests.filter((r) => r.status === "open").length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Capabilities</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-0.5">
            <p>Update profiles · Submit quotations</p>
            <p>Accept POs · Upload invoices</p>
            <p>Track payments · Open tickets</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-sm font-semibold mb-2">Enable portal access</h2>
      <div className="rounded-lg border overflow-x-auto mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Token</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.slice(0, 40).map((s) => (
              <TableRow key={String(s.id)}>
                <TableCell className="font-medium text-sm">{String(s.name)}</TableCell>
                <TableCell className="text-sm">{String(s.email || "—")}</TableCell>
                <TableCell>
                  {s.portal_enabled ? <Badge>Enabled</Badge> : <Badge variant="secondary">Off</Badge>}
                </TableCell>
                <TableCell className="font-mono text-[10px]">
                  {s.portal_token ? String(s.portal_token).slice(0, 12) + "…" : "—"}
                </TableCell>
                <TableCell>
                  {!s.portal_enabled && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => enable(String(s.id))}>
                      <Key className="h-3 w-3 mr-1" /> Enable
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h2 className="text-sm font-semibold mb-2">Portal requests</h2>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  No portal requests yet
                </TableCell>
              </TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="capitalize text-sm">{String(r.request_type)}</TableCell>
                  <TableCell className="font-medium text-sm">{String(r.subject)}</TableCell>
                  <TableCell className="text-sm">
                    {(r.suppliers as { name?: string } | null)?.name || "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
