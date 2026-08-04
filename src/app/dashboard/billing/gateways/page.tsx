"use client";

import { useEffect, useState } from "react";
import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";

export default function GatewaysPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("bill_payment_gateways").select("*").order("name");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const toggle = async (id: string, is_active: boolean) => {
    try {
      const res = await crudUpdate("bill_payment_gateways", id, { is_active: !is_active });
      if (!res.ok) throw new Error(res.error);
      toast.success(is_active ? "Gateway disabled" : "Gateway enabled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading payment gateways…" />;

  return (
    <div>
      <PageHeader
        title="Payment Gateways"
        description="Cash · bank · MTN MoMo · Airtel Money · card · Flutterwave · Pesapal"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((g) => (
          <Card key={String(g.id)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="h-4 w-4 text-teal-700" />
                {String(g.name)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-mono text-xs">{String(g.gateway_code)} · {String(g.provider)}</p>
              <div className="flex flex-wrap gap-1">
                {((g.supported_currencies as string[]) || []).map((c) => (
                  <Badge key={c} variant="outline">{c}</Badge>
                ))}
              </div>
              <Badge variant={g.is_active ? "default" : "secondary"}>
                {g.is_active ? "Active" : "Inactive"}
              </Badge>
              <div>
                <Button size="sm" variant="outline" onClick={() => toggle(String(g.id), Boolean(g.is_active))}>
                  {g.is_active ? "Disable" : "Enable"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        External gateways (Flutterwave, Pesapal, Stripe) store config keys in gateway config JSON — enable after credentials are set in Settings → Integrations.
      </p>
    </div>
  );
}
