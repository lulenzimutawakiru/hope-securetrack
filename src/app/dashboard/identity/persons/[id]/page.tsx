"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Fingerprint, Link2, Network } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { getPersonGraph, MODULE_IDENTITY_MAP } from "@/lib/unified-identity";
import { toast } from "sonner";

export default function PersonDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [loading, setLoading] = useState(true);
  const [graph, setGraph] = useState<Awaited<ReturnType<typeof getPersonGraph>> | null>(null);

  useEffect(() => {
    if (!id) return;
    getPersonGraph(id)
      .then(setGraph)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingState message="Loading person 360°…" />;
  if (!graph) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Person not found.</p>
        <Button asChild className="mt-4" variant="outline" size="sm">
          <Link href="/dashboard/identity/persons">Back</Link>
        </Button>
      </div>
    );
  }

  const p = graph.person;

  return (
    <div>
      <PageHeader
        title={String(p.display_name)}
        description={`${p.upid} · single digital identity across the ERP`}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/identity/persons">
              <ArrowLeft className="h-4 w-4 mr-1" /> Directory
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground">UPID</p>
            <p className="font-mono text-sm font-semibold">{String(p.upid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground">Status</p>
            <StatusBadge status={String(p.status)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground">Department</p>
            <p className="text-sm font-medium">{String(p.department || "—")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground">Job title</p>
            <p className="text-sm font-medium">{String(p.job_title || "—")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Fingerprint className="h-4 w-4" /> Core identity
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{String(p.primary_email || "—")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{String(p.primary_phone || "—")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Clearance</span><span>{String(p.security_clearance || "—")}</span></div>
            <div className="flex flex-wrap gap-1 pt-2">
              {(p.person_kinds as string[] | null)?.map((k) => (
                <Badge key={k} variant="secondary" className="text-[10px] capitalize">{k}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Linked records
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="rounded border p-2">
              <p className="text-[10px] text-muted-foreground">Auth account</p>
              {graph.auth ? (
                <>
                  <p className="font-medium">{String(graph.auth.email)}</p>
                  <p className="text-[10px]">
                    {graph.auth.username ? `@${graph.auth.username}` : ""} · {String(graph.auth.account_status || (graph.auth.is_active ? "active" : "inactive"))}
                  </p>
                  <Button asChild size="sm" variant="link" className="h-auto p-0 text-xs mt-1">
                    <Link href={`/dashboard/identity/users/${graph.auth.id}`}>Open IDM user</Link>
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">Not linked</p>
              )}
            </div>
            <div className="rounded border p-2">
              <p className="text-[10px] text-muted-foreground">Employee (HR)</p>
              {graph.employee ? (
                <>
                  <p className="font-medium">{String(graph.employee.employee_number)}</p>
                  <p className="text-[10px]">{String(graph.employee.department || "")} · {String(graph.employee.job_title || "")}</p>
                  <Button asChild size="sm" variant="link" className="h-auto p-0 text-xs mt-1">
                    <Link href="/dashboard/profiles">Open profiles</Link>
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">Not linked</p>
              )}
            </div>
            <div className="rounded border p-2">
              <p className="text-[10px] text-muted-foreground">Workforce credential</p>
              {graph.credential ? (
                <>
                  <p className="font-medium font-mono text-xs">{String(graph.credential.identity_number)}</p>
                  <StatusBadge status={String(graph.credential.status)} />
                  <Button asChild size="sm" variant="link" className="h-auto p-0 text-xs mt-1 block">
                    <Link href="/dashboard/credentials">Open credentials</Link>
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">Not linked</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4" /> Module entitlements
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {graph.entitlements.length === 0 && (
              <p className="text-xs text-muted-foreground">No entitlements recorded</p>
            )}
            {graph.entitlements.map((e) => (
              <Badge key={String(e.id)} variant="outline" className="text-[10px]">
                {String(e.module_code)}:{String(e.entitlement)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All module links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {graph.links.length === 0 && (
              <p className="text-sm text-muted-foreground">No links yet</p>
            )}
            {graph.links.map((l) => (
              <div key={String(l.id)} className="flex justify-between text-sm border-b last:border-0 pb-2">
                <div>
                  <Badge variant="secondary" className="text-[10px] mr-1 capitalize">
                    {String(l.link_type).replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{String(l.module_code)}</span>
                  {l.entity_code ? (
                    <p className="text-[10px] font-mono mt-0.5">{String(l.entity_code)}</p>
                  ) : null}
                </div>
                {l.is_primary ? <Badge className="text-[9px] h-fit">Primary</Badge> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity lifecycle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-80 overflow-y-auto">
            {graph.events.map((ev) => (
              <div key={String(ev.id)} className="border-l-2 border-primary/30 pl-3">
                <p className="text-sm font-medium">{String(ev.title)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {ev.occurred_at ? new Date(String(ev.occurred_at)).toLocaleString() : ""} ·{" "}
                  {String(ev.event_type)}
                  {ev.module_code ? ` · ${ev.module_code}` : ""}
                </p>
                {ev.details ? <p className="text-xs text-muted-foreground mt-0.5">{String(ev.details)}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Where this person appears in the ERP</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {MODULE_IDENTITY_MAP.map((m) => {
            const entitled = graph.modules.includes(m.module as (typeof graph.modules)[number]);
            return (
              <div
                key={m.module}
                className={`rounded-md border p-2 text-xs ${entitled ? "border-primary/40 bg-primary/5" : "opacity-60"}`}
              >
                <p className="font-medium">{m.label}</p>
                <p className="text-muted-foreground mt-0.5">{m.description}</p>
                <Badge variant={entitled ? "default" : "secondary"} className="text-[9px] mt-1">
                  {entitled ? "Entitled" : "Not entitled"}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
