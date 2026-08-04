"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";

export default function ChannelsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await createClient()
      .from("sd_channels")
      .select("*")
      .order("channel_type");
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const toggle = async (id: string, active: boolean) => {
    const crudRes = await crudUpdate("sd_channels", id, { is_active: !active });
    toast.success(active ? "Channel disabled" : "Channel enabled");
    await load();
  };

  if (loading) return <LoadingState message="Loading channels…" />;

  const active = rows.filter((r) => r.is_active).length;

  return (
    <div>
      <PageHeader
        title="Omni-Channel"
        description="Email · portal · chat · WhatsApp · Teams · Slack · phone"
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Channels" value={String(rows.length)} icon={MessageSquare} />
        <StatCard title="Active" value={String(active)} icon={MessageSquare} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <Card key={String(r.id)}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start gap-2">
                <CardTitle className="text-base">{String(r.name)}</CardTitle>
                <Badge variant={r.is_active ? "default" : "outline"} className="capitalize text-[10px]">
                  {String(r.channel_type)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="text-[10px] bg-muted/50 p-2 rounded overflow-x-auto max-h-24">
                {JSON.stringify(r.config || {}, null, 2)}
              </pre>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {r.is_active ? "Receiving tickets" : "Disabled"}
                </span>
                <Button size="sm" variant="outline" onClick={() => toggle(String(r.id), Boolean(r.is_active))}>
                  {r.is_active ? "Disable" : "Enable"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-2"><CardTitle className="text-base">Channel setup notes</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>Email:</strong> Point support@ mailbox / Resend inbound webhook to auto-create tickets.</p>
          <p><strong>WhatsApp / Teams / Slack:</strong> Enable channel then connect credentials under Integrations Hub.</p>
          <p><strong>Phone:</strong> Log call_ref on tickets for recording reference and agent notes.</p>
        </CardContent>
      </Card>
    </div>
  );
}
