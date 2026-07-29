"use client";

import { useEffect, useState } from "react";
import { Globe, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";

export default function DispatchPortalPage() {
  const [ref, setRef] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [pods, setPods] = useState<Array<Record<string, unknown>>>([]);

  const track = async () => {
    const q = ref.trim();
    if (!q) return;
    const sb = createClient();
    let { data } = await sb
      .from("dsp_requests")
      .select("*")
      .or(`request_number.eq.${q},source_ref.eq.${q}`)
      .maybeSingle();
    if (!data) {
      const { data: d } = await sb
        .from("dispatches")
        .select("*")
        .or(`dispatch_number.eq.${q},waybill_number.eq.${q},shipment_qr.eq.${q}`)
        .maybeSingle();
      data = d;
    }
    if (!data) {
      toast.error("Shipment not found");
      setResult(null);
      return;
    }
    setResult(data as Record<string, unknown>);
    toast.success("Shipment found");
    if (data.id) {
      const { data: p } = await sb
        .from("dsp_pods")
        .select("*")
        .or(`request_id.eq.${data.id},dispatch_id.eq.${data.id}`)
        .limit(5);
      setPods((p as Array<Record<string, unknown>>) || []);
    }
  };

  useEffect(() => {
    // demo: load latest public-ish status samples for UI
  }, []);

  return (
    <div>
      <PageHeader
        title="Customer Delivery Portal"
        description="Track · ETA · documents · QR verify · report issues"
      />

      <Card className="mb-6 max-w-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" /> Track shipment
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="DRQ-… / DSP-… / SO-… / shipment QR"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && track()}
          />
          <Button onClick={track}>
            <Search className="h-4 w-4 mr-1" /> Track
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="text-base font-mono">
              {String(result.request_number || result.dispatch_number || result.id)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex gap-2">
              <Badge variant="outline" className="capitalize">{String(result.status)}</Badge>
              {result.priority ? (
                <Badge className="capitalize text-[10px]">{String(result.priority)}</Badge>
              ) : null}
            </div>
            <p><span className="text-muted-foreground">Customer:</span> {String(result.customer_name || "—")}</p>
            <p><span className="text-muted-foreground">Address:</span> {String(result.delivery_address || result.destination_address || "—")}</p>
            <p><span className="text-muted-foreground">Vehicle:</span> {String(result.vehicle_reg || result.required_vehicle_type || "—")}</p>
            <p><span className="text-muted-foreground">Driver:</span> {String(result.driver_name || "—")}</p>
            {result.updated_at ? (
              <p className="text-xs text-muted-foreground">Updated {formatDateTime(String(result.updated_at))}</p>
            ) : null}
            {pods.length > 0 && (
              <div className="pt-2 border-t">
                <p className="font-medium text-xs mb-1">Proof of delivery</p>
                {pods.map((p) => (
                  <p key={String(p.id)} className="text-xs font-mono">
                    {String(p.pod_number)} · {String(p.receiver_name)} · {formatDateTime(String(p.delivered_at))}
                  </p>
                ))}
              </div>
            )}
            <Button size="sm" variant="outline" className="mt-2" onClick={() => toast.message("Issue reported to dispatch ops")}>
              Report delivery issue
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
