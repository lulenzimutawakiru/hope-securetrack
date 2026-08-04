"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquare, Users, CheckSquare, Video, Sparkles, ArrowRight,
  Smile, Star, Frown, Angry, Activity,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { communicationAnalytics } from "@/lib/hopechat";
import type { CommunicationAnalytics } from "@/lib/hopechat";

const SEVERITY_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
> = {
  critical: "destructive",
  warning: "warning",
  info: "outline",
  success: "success",
};

const SENTIMENT_META = [
  { key: "positive", label: "Positive", icon: Smile },
  { key: "neutral", label: "Neutral", icon: Star },
  { key: "negative", label: "Negative", icon: Frown },
  { key: "frustrated", label: "Frustrated", icon: Angry },
] as const;

export default function ChatExecutivePage() {
  const { auth } = useUser();
  const [analytics, setAnalytics] = useState<CommunicationAnalytics | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<Array<Record<string, unknown>>>([]);
  const [meetingCount, setMeetingCount] = useState(0);
  const [aiSessions, setAiSessions] = useState(0);
  const [loading, setLoading] = useState(true);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [channelsRes, msgRes, apprRes, meetRes, aiRes] = await Promise.all([
      supabase
        .from("hc_channels")
        .select("id,name,slug,description,department_code,last_message_at")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .eq("is_archived", false)
        .limit(500),
      supabase
        .from("hc_messages")
        .select("id,channel_id,sender_id,sender_name,body,message_type,created_at")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .limit(800),
      supabase
        .from("hc_approvals")
        .select("id,entity_type,title,amount,currency,status,requester_name,approver_name,created_at")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .limit(300),
      supabase.from("hc_meetings").select("id").eq("company_id", companyId).limit(300),
      supabase
        .from("hc_copilot_sessions")
        .select("id")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .limit(300),
    ]);

    const channels = (channelsRes.data as Array<Record<string, unknown>>) || [];
    const messages = (msgRes.data as Array<Record<string, unknown>>) || [];
    const approvals = (apprRes.data as Array<Record<string, unknown>>) || [];

    setAnalytics(communicationAnalytics({ messages, channels, approvals }));
    setPendingApprovals(
      approvals
        .filter((a) => String(a.status || "") === "pending")
        .slice(0, 6)
    );
    setMeetingCount(meetRes.data?.length || 0);
    setAiSessions(aiRes.data?.length || 0);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [companyId]);

  if (loading) return <LoadingState message="Loading executive communication center..." />;
  if (!analytics) {
    return (
      <EmptyState
        icon={Activity}
        title="No communication data"
        description="Channels, messages and approvals will appear here once teams start collaborating."
      />
    );
  }

  const sentimentTotal = Object.values(analytics.sentimentMix).reduce((s, n) => s + n, 0);

  return (
    <div>
      <PageHeader
        title="Executive Communication Center"
        description="Organization communication health - activity, approvals, sentiment and AI insights"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/chat/approvals">
                <CheckSquare className="h-4 w-4 mr-1" /> Approvals
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/chat/analytics">
                <Activity className="h-4 w-4 mr-1" /> Analytics
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active conversations"
          value={analytics.activeConversations}
          icon={MessageSquare}
          description={`${analytics.totalMessages} messages in ${analytics.totalChannels} channels`}
        />
        <StatCard
          title="Engagement index"
          value={`${analytics.engagementIndex}%`}
          icon={Users}
          description={`${analytics.participants} active participants`}
        />
        <StatCard
          title="Pending approvals"
          value={analytics.pendingApprovals}
          icon={CheckSquare}
          description={
            analytics.approvalCompletionRate !== null
              ? `${Math.round(analytics.approvalCompletionRate * 100)}% completion rate`
              : "No decisions tracked yet"
          }
        />
        <StatCard
          title="Avg response time"
          value={analytics.avgResponseMinutes !== null ? `${analytics.avgResponseMinutes}m` : "--"}
          icon={Sparkles}
          description="Between speakers in active chats"
        />
        <StatCard
          title="Meetings scheduled"
          value={meetingCount}
          icon={Video}
          description="SecureChat meetings"
        />
        <StatCard
          title="AI copilot usage"
          value={aiSessions}
          icon={Sparkles}
          description="SecureTrackAI assistant sessions"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">AI insights</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {analytics.aiInsights.map((insight) => (
              <div
                key={insight.id}
                className="flex items-start gap-3 rounded-lg border bg-background p-3"
              >
                <Badge variant={SEVERITY_VARIANT[insight.severity] || "outline"}>
                  {insight.severity}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{insight.title}</p>
                  <p className="text-xs text-muted-foreground">{insight.description}</p>
                </div>
                {Boolean(insight.action) && (
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={insight.action || "/dashboard/chat"}>
                      Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Conversation sentiment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {SENTIMENT_META.map((s) => {
              const Icon = s.icon;
              const count = analytics.sentimentMix[s.key] || 0;
              const pct = sentimentTotal ? Math.round((count / sentimentTotal) * 100) : 0;
              return (
                <div key={s.key} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="w-20 text-xs">{s.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs text-muted-foreground">{pct}%</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Department activity</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.departmentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No department-labelled channels or messages yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Channels</TableHead>
                    <TableHead className="text-right">Messages</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.departmentActivity.map((d) => (
                    <TableRow key={d.name}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-right">{d.channels}</TableCell>
                      <TableCell className="text-right">{d.messages}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Pending approvals</CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/dashboard/chat/approvals">
                View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {pendingApprovals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No approvals waiting for a decision. Everything is up to date.
              </p>
            ) : (
              pendingApprovals.map((a) => (
                <Link
                  key={String(a.id)}
                  href="/dashboard/chat/approvals"
                  className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{String(a.title)}</p>
                    <p className="text-xs text-muted-foreground">
                      {String(a.entity_type || "")} - {String(a.requester_name || "Unknown")} -{" "}
                      {formatDateTime(String(a.created_at || ""))}
                    </p>
                  </div>
                  {a.amount !== null && a.amount !== undefined && (
                    <Badge variant="secondary">
                      {String(a.currency || "UGX")} {Number(a.amount).toLocaleString()}
                    </Badge>
                  )}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}