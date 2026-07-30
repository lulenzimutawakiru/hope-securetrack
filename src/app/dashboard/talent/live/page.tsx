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
import { createClient } from "@/lib/supabase/client";

export default function TalentLiveBoardPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<Array<Record<string, unknown>>>([]);
  const [interviews, setInterviews] = useState<Array<Record<string, unknown>>>([]);
  const [offers, setOffers] = useState<Array<Record<string, unknown>>>([]);

  const load = async () => {
    const cid = auth?.profile?.company_id;
    if (!cid) {
      setLoading(false);
      return;
    }
    const sb = createClient();
    const [a, i, o] = await Promise.all([
      sb
        .from("ta_applications")
        .select("application_number,candidate_name,stage_code,status,match_score")
        .eq("company_id", cid)
        .eq("status", "open")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(20),
      sb
        .from("ta_interviews")
        .select("interview_code,candidate_name,status,scheduled_at")
        .eq("company_id", cid)
        .eq("status", "scheduled")
        .is("deleted_at", null)
        .order("scheduled_at")
        .limit(15),
      sb
        .from("ta_offers")
        .select("offer_number,candidate_name,status,candidate_response")
        .eq("company_id", cid)
        .in("status", ["issued", "draft"])
        .is("deleted_at", null)
        .limit(15),
    ]);
    setApps((a.data as Array<Record<string, unknown>>) || []);
    setInterviews((i.data as Array<Record<string, unknown>>) || []);
    setOffers((o.data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [auth]);

  if (loading) return <LoadingState message="Loading live hiring board…" />;

  return (
    <div>
      <PageHeader
        title="Live hiring board"
        description="Auto-refreshes every 30s"
        actions={
          <Button size="sm" variant="outline" onClick={() => load()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" /> Active applications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {apps.map((a, i) => (
              <div key={i} className="rounded border px-2 py-1.5 text-sm">
                <p className="font-medium truncate">{String(a.candidate_name)}</p>
                <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                  <span>{String(a.application_number)}</span>
                  <Badge variant="outline">{String(a.stage_code)}</Badge>
                </div>
              </div>
            ))}
            <Button size="sm" variant="ghost" asChild className="w-full">
              <Link href="/dashboard/talent/ats">Open ATS</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Upcoming interviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {interviews.length === 0 ? (
              <p className="text-xs text-muted-foreground">None scheduled</p>
            ) : (
              interviews.map((x, i) => (
                <div key={i} className="rounded border px-2 py-1.5 text-sm">
                  <p className="font-medium truncate">{String(x.candidate_name)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {String(x.scheduled_at || "—")}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Open offers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {offers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No open offers</p>
            ) : (
              offers.map((x, i) => (
                <div key={i} className="rounded border px-2 py-1.5 text-sm">
                  <p className="font-medium truncate">{String(x.candidate_name)}</p>
                  <div className="flex gap-1 mt-0.5">
                    <Badge variant="outline">{String(x.status)}</Badge>
                    <Badge variant="secondary">{String(x.candidate_response)}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
