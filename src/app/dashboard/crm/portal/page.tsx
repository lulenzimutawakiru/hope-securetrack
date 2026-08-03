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
import { listCustomers, listPortalRequests, enableCustomerPortal } from "@/lib/crm";
import { toast } from "sonner";

export default function CrmPortalPage() {
  const { auth } = useUser();
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [c, r] = await Promise.all([listCustomers({ limit: 100 }), listPortalRequests()]);
      setCustomers(c);
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
      await enableCustomerPortal(id, auth.profile.company_id);
      toast.success("Portal enabled with secure token");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading portal admin…" />;

  const enabled = customers.filter((c) => c.portal_enabled);

  return (
    <div>
      <PageHeader
        title="Customer Self-Service Portal"
        description="Quotes · orders · production · dispatch · invoices · tickets · QR verify · SecureChat"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/verify">QR product verify</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/crm">Hub</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Portal-enabled</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{enabled.length}</CardContent>
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
            <p>View / approve quotations · Place orders</p>
            <p>Track production & dispatch · Invoices</p>
            <p>Support tickets · QR authenticity</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-sm font-semibold mb-2">Enable portal access</h2>
      <div className="rounded-lg border overflow-x-auto mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Token</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.slice(0, 40).map((c) => (
              <TableRow key={String(c.id)}>
                <TableCell className="font-medium text-sm">{String(c.name)}</TableCell>
                <TableCell className="text-sm">{String(c.email || "—")}</TableCell>
                <TableCell>
                  {c.portal_enabled ? (
                    <Badge>Enabled</Badge>
                  ) : (
                    <Badge variant="secondary">Off</Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono text-[10px] max-w-[120px] truncate">
                  {c.portal_token ? String(c.portal_token).slice(0, 12) + "…" : "—"}
                </TableCell>
                <TableCell>
                  {!c.portal_enabled && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => enable(String(c.id))}>
                      <Key className="h-3 w-3 mr-1" /> Enable
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Globe className="h-4 w-4" /> Portal requests
      </h2>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  No portal requests yet
                </TableCell>
              </TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="capitalize text-sm">{String(r.request_type)}</TableCell>
                  <TableCell className="font-medium text-sm">{String(r.subject)}</TableCell>
                  <TableCell className="text-sm">
                    {(r.customers as { name?: string } | null)?.name || "—"}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{String(r.priority)}</Badge></TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.created_at ? new Date(String(r.created_at)).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
