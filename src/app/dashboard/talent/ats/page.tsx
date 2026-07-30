"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, GripVertical } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { taUpdate } from "@/lib/ta/crud";
import { toast } from "sonner";

const DEFAULT_STAGES = [
  { code: "applied", name: "Applied" },
  { code: "screen", name: "Screening" },
  { code: "shortlist", name: "Shortlisted" },
  { code: "assessment", name: "Assessment" },
  { code: "interview", name: "Interview" },
  { code: "background", name: "Background" },
  { code: "offer", name: "Offer" },
  { code: "hired", name: "Hired" },
  { code: "rejected", name: "Rejected" },
];

export default function AtsPipelinePage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<Array<Record<string, unknown>>>([]);
  const [stages, setStages] = useState(DEFAULT_STAGES);
  const [dragId, setDragId] = useState<string | null>(null);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const sb = createClient();
    const [{ data: stageRows }, { data: appRows }] = await Promise.all([
      sb
        .from("ta_pipeline_stages")
        .select("stage_code,name,sort_order")
        .eq("company_id", companyId)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("sort_order"),
      sb
        .from("ta_applications")
        .select("id,application_number,candidate_name,vacancy_title,stage_code,match_score,status")
        .eq("company_id", companyId)
        .eq("status", "open")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(300),
    ]);
    if (stageRows?.length) {
      setStages(
        stageRows.map((s) => ({
          code: String(s.stage_code),
          name: String(s.name),
        }))
      );
    }
    setApps((appRows as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const byStage = useMemo(() => {
    const map = new Map<string, Array<Record<string, unknown>>>();
    for (const s of stages) map.set(s.code, []);
    for (const a of apps) {
      const code = String(a.stage_code || "applied");
      if (!map.has(code)) map.set(code, []);
      map.get(code)!.push(a);
    }
    return map;
  }, [apps, stages]);

  const moveToStage = async (appId: string, stageCode: string, stageName: string) => {
    try {
      await taUpdate(
        "ta_applications",
        appId,
        {
          stage_code: stageCode,
          stage_name: stageName,
          last_stage_at: new Date().toISOString(),
          status: stageCode === "hired" ? "hired" : stageCode === "rejected" ? "rejected" : "open",
        },
        auth?.user.id
      );
      toast.success(`Moved to ${stageName}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Move failed");
    }
  };

  if (loading) return <LoadingState message="Loading ATS pipeline…" />;

  return (
    <div>
      <PageHeader
        title="Applicant Tracking System"
        description="Drag applications across configurable pipeline stages"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/talent/applications">List view</Link>
            </Button>
          </div>
        }
      />

      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const items = byStage.get(stage.code) || [];
          return (
            <Card
              key={stage.code}
              className="min-w-[260px] max-w-[280px] shrink-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) moveToStage(dragId, stage.code, stage.name);
                setDragId(null);
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{stage.name}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 min-h-[320px]">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Drop cards here</p>
                ) : (
                  items.map((a) => (
                    <div
                      key={String(a.id)}
                      draggable
                      onDragStart={() => setDragId(String(a.id))}
                      className="rounded-lg border bg-background p-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/40"
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-mono text-muted-foreground">
                            {String(a.application_number)}
                          </p>
                          <p className="text-sm font-medium truncate">
                            {String(a.candidate_name)}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {String(a.vacancy_title || "—")}
                          </p>
                          <div className="mt-1.5 flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px]">
                              Match {String(a.match_score ?? 0)}
                            </Badge>
                            <Link
                              href="/dashboard/talent/applications"
                              className="text-[10px] text-primary hover:underline"
                            >
                              Open
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
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
