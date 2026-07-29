"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { listMessages } from "@/lib/communications";
import { formatDateTime } from "@/lib/utils";

const COLS = ["queued", "sending", "sent", "failed", "scheduled"] as const;

export default function CommLiveBoardPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  const load = async () => {
    const cid = auth?.profile?.company_id;
    if (!cid) {
      setLoading(false);
      return;
    }
    try {
      const data = await listMessages({ companyId: cid, limit: 120 });
      setRows(data as Array<Record<string, unknown>>);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [auth]);

  if (loading) return <LoadingState message="Loading live communications board…" />;

  return (
    <div>
      <PageHeader
        title="Live communications board"
        description="Auto-refreshes every 20s · drill into any card"
        actions={
          <Button size="sm" variant="outline" onClick={() => load()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {COLS.map((col) => {
          const items = rows.filter((r) => String(r.status) === col).slice(0, 12);
          return (
            <Card key={col} className="min-h-[280px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between capitalize">
                  <span className="inline-flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    {col}
                  </span>
                  <Badge variant="secondary">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Empty</p>
                ) : (
                  items.map((m) => (
                    <Link
                      key={String(m.id)}
                      href={`/dashboard/communications/messages/${m.id}`}
                      className="block rounded-lg border bg-muted/20 px-2.5 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <p className="text-[11px] font-mono text-muted-foreground">
                        {String(m.message_number)}
                      </p>
                      <p className="text-xs font-medium line-clamp-2 mt-0.5">
                        {String(m.subject || "(no subject)")}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {String(m.channel)}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {formatDateTime(String(m.created_at))}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
