"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";

const PAYMENT_CONNECTORS = [
  "MTN_MOMO", "AIRTEL_MONEY", "PESAPAL", "STRIPE", "FLUTTERWAVE", "PAYPAL", "BANK_API",
];

export default function IntegrationPaymentsPage() {
  const [connectors, setConnectors] = useState<Array<Record<string, unknown>>>([]);
  const [connections, setConnections] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: c }, { data: conn }] = await Promise.all([
        supabase.from("intg_connectors").select("*").in("connector_code", PAYMENT_CONNECTORS),
        supabase
          .from("intg_connections")
          .select("*, intg_connectors(connector_code,name)")
          .is("deleted_at", null),
      ]);
      setConnectors(c ?? []);
      setConnections(
        (conn || []).filter((x) =>
          PAYMENT_CONNECTORS.includes(
            String((x.intg_connectors as { connector_code?: string } | null)?.connector_code || "")
          )
        )
      );
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading payment integrations…" />;

  return (
    <div>
      <PageHeader
        title="Payment Integrations"
        description="MTN · Airtel · Pesapal · Stripe · Flutterwave · PayPal · Bank APIs · reconciliation"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/billing/gateways">Billing gateways</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/integrations/connectors">Marketplace</Link>
            </Button>
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {connectors.map((c) => (
          <Card key={String(c.id)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-teal-700" /> {String(c.name)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <Badge variant="outline">{String(c.protocol)}</Badge>
              <Badge variant="outline">{String(c.auth_type)}</Badge>
              <p className="text-xs text-muted-foreground">{String(c.description)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <h3 className="text-sm font-semibold mb-2">Active payment connections</h3>
      <div className="space-y-2">
        {connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">Install payment connectors and configure under Connections.</p>
        ) : (
          connections.map((c) => (
            <div key={String(c.id)} className="flex items-center justify-between rounded border p-3 text-sm">
              <div>
                <div className="font-medium">{String(c.name)}</div>
                <div className="text-xs text-muted-foreground">
                  {(c.intg_connectors as { name?: string } | null)?.name} · {String(c.environment)}
                </div>
              </div>
              <StatusBadge status={String(c.status)} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
