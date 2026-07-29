"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Scale, Siren, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import { computeSecurityScores, generateExecutiveSummary, type SecurityScores } from "@/lib/audit";

export default function AuditExecutivePage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<SecurityScores | null>(null);
  const [brief, setBrief] = useState("");

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      const s = await computeSecurityScores(companyId);
      setScores(s);
      setBrief(
        generateExecutiveSummary({
          securityScore: s.securityScore,
          complianceScore: s.complianceScore,
          activeIncidents: s.activeIncidents,
          openAlerts: s.openAlerts,
          failedLogins24h: s.failedLogins24h,
          highRiskUserCount: s.highRiskUsers.length,
        })
      );
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [companyId]);

  if (loading || !scores) return <LoadingState message="Loading executive dashboard…" />;

  const scoreColor = (n: number) =>
    n >= 85 ? "text-green-600" : n >= 70 ? "text-amber-600" : "text-destructive";

  return (
    <div>
      <PageHeader
        title="Executive Security Dashboard"
        description="Security score · compliance score · incidents · high-risk users"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/audit/reports">Reports</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/audit/packages">Packages</Link></Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <Shield className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Security Score</p>
            <p className={`text-4xl font-bold ${scoreColor(scores.securityScore)}`}>{scores.securityScore}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Scale className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Compliance Score</p>
            <p className={`text-4xl font-bold ${scoreColor(scores.complianceScore)}`}>{scores.complianceScore}</p>
          </CardContent>
        </Card>
        <StatCard title="Active incidents" value={String(scores.activeIncidents)} icon={Siren} />
        <StatCard title="Open alerts" value={String(scores.openAlerts)} icon={Shield} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> High-risk users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {scores.highRiskUsers.map((u) => (
              <div key={u.email} className="flex justify-between text-sm border-b pb-2">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="text-right">
                  <Badge variant={u.risk >= 70 ? "destructive" : "outline"}>risk {u.risk}</Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">{u.events} events</p>
                </div>
              </div>
            ))}
            {scores.highRiskUsers.length === 0 && (
              <p className="text-sm text-muted-foreground">No high-risk users in sample.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI executive brief</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground">{brief}</pre>
            <div className="flex flex-wrap gap-2 mt-4 text-xs">
              <Badge variant="outline">MFA coverage {scores.mfaCoverage}%</Badge>
              <Badge variant="outline">Failed logins 24h: {scores.failedLogins24h}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
