"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { listProviders } from "@/lib/communications";

export default function ProvidersPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    listProviders(auth.profile.company_id)
      .then((d) => setRows(d as Array<Record<string, unknown>>))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth]);

  if (loading) return <LoadingState message="Loading providers…" />;

  return (
    <div>
      <PageHeader
        title="Communication Providers"
        description="Resend · Microsoft 365 · SMS · WhatsApp · FCM · rate limits"
      />
      {rows.length === 0 ? (
        <EmptyState title="No providers" description="Seed providers via migration 00052." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.id as string}>
              <CardHeader className="pb-2">
                <div className="flex justify-between gap-2">
                  <CardTitle className="text-sm">{String(r.display_name)}</CardTitle>
                  <Badge variant={r.is_active ? "default" : "secondary"}>
                    {r.is_active ? "active" : "inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <p><span className="text-muted-foreground">Code:</span> {String(r.provider_code)}</p>
                <p><span className="text-muted-foreground">Type:</span> {String(r.provider_type)}</p>
                <p><span className="text-muted-foreground">Default:</span> {r.is_default ? "yes" : "no"}</p>
                <p><span className="text-muted-foreground">Rate:</span> {String(r.rate_limit_per_minute)}/min</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
