"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitBranch, ArrowRight, UserX, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { useUser } from "@/hooks/use-user";
import {
  listPersonsByLifecycle,
  getLifecycleCounts,
  advanceLifecycle,
  orchestrateExit,
  LIFECYCLE_PIPELINE,
  type LifecycleStage,
} from "@/lib/digital-identity";
import { toast } from "sonner";

export default function LifecyclePage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [persons, setPersons] = useState<Array<Record<string, unknown>>>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [stage, setStage] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const [list, c] = await Promise.all([
        listPersonsByLifecycle({
          stage: stage === "all" ? undefined : stage,
          limit: 200,
        }),
        getLifecycleCounts(),
      ]);
      setPersons(list as Array<Record<string, unknown>>);
      setCounts(c);
    } catch {
      /* migration pending */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [stage]);

  const advance = async (personId: string, to: LifecycleStage) => {
    if (!auth) return;
    setBusy(personId);
    try {
      await advanceLifecycle({
        person_id: personId,
        company_id: auth.profile.company_id,
        to_stage: to,
        actor_id: auth.user.id,
      });
      toast.success(`Moved to ${to}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const exit = async (personId: string) => {
    if (!auth) return;
    if (!confirm("Revoke access, cards, biometrics, and archive this person?")) return;
    setBusy(personId);
    try {
      await orchestrateExit({
        person_id: personId,
        company_id: auth.profile.company_id,
        reason: "Manual offboarding",
        actor_id: auth.user.id,
      });
      toast.success("Offboarding complete");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Exit failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <LoadingState message="Loading employee lifecycle…" />;

  return (
    <div>
      <PageHeader
        title="Employee Lifecycle"
        description="Recruitment → Onboarding → Active → Exit · one stage updates all modules"
        actions={
          <div className="flex gap-2">
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {LIFECYCLE_PIPELINE.map((s) => (
                  <SelectItem key={s.stage} value={s.stage}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild size="sm">
              <Link href="/dashboard/identity/hire">
                <Play className="h-4 w-4 mr-1" /> Hire & provision
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5 mb-6 overflow-x-auto pb-1">
        {LIFECYCLE_PIPELINE.map((s, i) => (
          <button
            key={s.stage}
            type="button"
            onClick={() => setStage(s.stage)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
              stage === s.stage
                ? "bg-hope-navy text-white border-hope-navy"
                : "bg-white hover:bg-slate-50"
            }`}
          >
            <span className="font-medium">{s.label}</span>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {counts[s.stage] || 0}
            </Badge>
            {i < LIFECYCLE_PIPELINE.length - 1 && (
              <ArrowRight className="h-3 w-3 opacity-40 ml-0.5" />
            )}
          </button>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4" /> Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Every stage transition updates auth status, ID cards, biometrics, assets, and audit logs automatically.
        </CardContent>
      </Card>

      {persons.length === 0 ? (
        <EmptyState
          title="No persons in this stage"
          description="Hire employees or advance existing digital identities."
        />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UPID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Clearance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {persons.map((p) => {
                const current = String(p.lifecycle_stage || "active");
                const idx = LIFECYCLE_PIPELINE.findIndex((s) => s.stage === current);
                const next = LIFECYCLE_PIPELINE[idx + 1]?.stage as LifecycleStage | undefined;
                return (
                  <TableRow key={p.id as string}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/dashboard/identity/persons/${p.id}`}
                        className="text-hope-navy hover:underline"
                      >
                        {String(p.upid)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{String(p.display_name)}</TableCell>
                    <TableCell className="text-sm">{String(p.department || "—")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{current}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(p.status)} />
                    </TableCell>
                    <TableCell className="text-xs">{String(p.clearance_level || p.security_clearance || "—")}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {next && next !== "archived" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === p.id}
                          onClick={() => advance(p.id as string, next)}
                        >
                          → {next}
                        </Button>
                      )}
                      {current !== "archived" && current !== "offboarding" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy === p.id}
                          onClick={() => exit(p.id as string)}
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
