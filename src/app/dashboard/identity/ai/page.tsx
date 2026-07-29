"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wand2, AlertTriangle, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { analyzeUserRisks, recommendRole, type IdmAiInsight } from "@/lib/idm";

export default function IdentityAiPage() {
  const [insights, setInsights] = useState<IdmAiInsight[]>([]);
  const [roleRecs, setRoleRecs] = useState<Array<{ label: string; reason: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: users }, { data: roles }, { data: rolePerms }] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("id,email,first_name,last_name,is_active,account_status,last_login_at,failed_login_count,mfa_enabled,require_mfa,mfa_enforced,user_type,job_title,account_expires_at,role_id,roles!user_profiles_role_id_fkey(name,slug)")
          .is("deleted_at", null)
          .limit(200),
        supabase.from("roles").select("id,name,slug").eq("is_active", true),
        supabase.from("role_permissions").select("role_id"),
      ]);

      const permCount = new Map<string, number>();
      for (const rp of rolePerms || []) {
        permCount.set(rp.role_id, (permCount.get(rp.role_id) || 0) + 1);
      }

      const inputs = (users || []).map((u) => {
        const r = u.roles as { name?: string; slug?: string } | null;
        return {
          id: u.id as string,
          email: u.email as string,
          first_name: u.first_name as string,
          last_name: u.last_name as string,
          is_active: u.is_active as boolean,
          account_status: u.account_status as string,
          last_login_at: u.last_login_at as string,
          failed_login_count: u.failed_login_count as number,
          mfa_enabled: u.mfa_enabled as boolean,
          require_mfa: u.require_mfa as boolean,
          mfa_enforced: u.mfa_enforced as boolean,
          user_type: u.user_type as string,
          job_title: u.job_title as string,
          role_slug: r?.slug,
          role_name: r?.name,
          permission_count: permCount.get(u.role_id as string) || 0,
          account_expires_at: u.account_expires_at as string,
        };
      });

      setInsights(analyzeUserRisks(inputs));

      const recs: Array<{ label: string; reason: string }> = [];
      for (const u of (users || []).slice(0, 15)) {
        const rec = recommendRole({
          job_title: u.job_title as string,
          department: undefined,
          user_type: u.user_type as string,
          availableRoles: (roles || []) as Array<{ id: string; name: string; slug: string }>,
        });
        const role = (roles || []).find((r) => r.id === rec.roleId);
        recs.push({
          label: `${u.first_name} ${u.last_name}`,
          reason: role ? `${role.name} — ${rec.reason}` : rec.reason,
        });
      }
      setRoleRecs(recs);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Running AI identity analysis…" />;

  const high = insights.filter((i) => i.severity === "high");
  const medium = insights.filter((i) => i.severity === "medium");

  return (
    <div>
      <PageHeader
        title="AI User Management Assistant"
        description="Roles · excessive permissions · inactive · MFA · suspicious login · onboarding"
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> High priority
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {high.length === 0 && <p className="text-sm text-muted-foreground">No high risks.</p>}
            {high.map((i, idx) => (
              <InsightCard key={idx} insight={i} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" /> Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {medium.slice(0, 20).map((i, idx) => (
              <InsightCard key={idx} insight={i} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Role recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {roleRecs.map((r, idx) => (
              <div key={idx} className="text-sm border-b py-1.5 last:border-0">
                <div className="font-medium">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.reason}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4 text-sm text-muted-foreground">
          Analyzed workforce for inactive accounts, failed logins, admin MFA gaps, permission sprawl, and expiring temporary access.
          Open <Link className="underline" href="/dashboard/identity/monitor">Security Monitor</Link> or{" "}
          <Link className="underline" href="/dashboard/identity/users">Directory</Link> to remediate.
        </CardContent>
      </Card>
    </div>
  );
}

function InsightCard({ insight }: { insight: IdmAiInsight }) {
  return (
    <div className="border rounded-md p-2.5 text-sm">
      <div className="flex justify-between gap-2">
        <span className="font-medium">{insight.title}</span>
        <Badge variant="outline" className="text-[10px] capitalize shrink-0">{insight.severity}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{insight.detail}</p>
      {insight.actions[0] && <p className="text-xs text-primary mt-1">→ {insight.actions[0]}</p>}
      {insight.userId && (
        <Button asChild size="sm" variant="link" className="px-0 h-auto">
          <Link href={`/dashboard/identity/users/${insight.userId}`}>Open user</Link>
        </Button>
      )}
    </div>
  );
}
