"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Plug,
  Unplug,
  Send,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { PermissionGate } from "@/components/security/permission-gate";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";

type Workspace = {
  id: string;
  team_id: string;
  team_name?: string | null;
  default_channel_id?: string | null;
  default_channel_name?: string | null;
  incoming_webhook_channel?: string | null;
  notify_tickets: boolean;
  notify_alerts: boolean;
  notify_approvals: boolean;
  is_enabled: boolean;
  last_error?: string | null;
  last_success_at?: string | null;
  installed_at?: string | null;
};

type Status = {
  platform_configured: boolean;
  app_id: string | null;
  workspaces: Workspace[];
};

export default function SlackIntegrationPage() {
  return (
    <PermissionGate
      anyOf={["intg.view", "intg.manage", "settings.integrations", "settings.manage"]}
    >
      <SlackIntegrationInner />
    </PermissionGate>
  );
}

function SlackIntegrationInner() {
  const search = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState("");
  const [testText, setTestText] = useState(
    "Hello from SecureTrack ERP — Slack is connected."
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<Status>("/api/v2/integrations/slack");
    if (res.ok) {
      setStatus(res.data);
      const ws = res.data.workspaces?.[0];
      if (ws?.default_channel_id) setChannel(ws.default_channel_id);
      else if (ws?.default_channel_name) setChannel(ws.default_channel_name);
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (search.get("connected") === "1") {
      toast.success("Slack workspace connected");
      void load();
    }
    const err = search.get("error");
    if (err) toast.error(`Slack connect failed: ${err}`);
  }, [search, load]);

  const connect = async () => {
    setBusy(true);
    try {
      const res = await apiGet<{ authorize_url: string }>(
        "/api/v2/integrations/slack/oauth/start"
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.location.href = res.data.authorize_url;
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const res = await apiPost("/api/v2/integrations/slack/test", {
        text: testText,
        channel: channel || null,
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Test message sent");
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (workspaceId: string) => {
    if (!confirm("Disconnect this Slack workspace from SecureTrack?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v2/integrations/slack", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        toast.error(json?.error?.message || "Disconnect failed");
      } else {
        toast.success("Disconnected");
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  const saveChannel = async (workspaceId: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/v2/integrations/slack", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          workspace_id: workspaceId,
          default_channel_id: channel.startsWith("C") ? channel : null,
          default_channel_name: channel.startsWith("#")
            ? channel
            : channel || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        toast.error(json?.error?.message || "Save failed");
      } else {
        toast.success("Channel saved");
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading Slack integration…" />;

  const ws = status?.workspaces?.[0];
  const connected = Boolean(ws?.is_enabled);

  return (
    <div>
      <PageHeader
        title="Slack · SecureChat"
        description="Connect your Slack workspace to receive ERP tickets, alerts, and approvals in Slack."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/integrations">
                <ArrowLeft className="mr-1 h-4 w-4" /> Integrations
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void load()}
              disabled={busy}
            >
              <RefreshCw className="mr-1 h-4 w-4" /> Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" /> Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Platform app</span>
              {status?.platform_configured ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Configured
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <ShieldAlert className="h-3 w-3" /> Missing env
                </Badge>
              )}
              {status?.app_id ? (
                <code className="text-xs text-muted-foreground">
                  {status.app_id}
                </code>
              ) : null}
            </div>

            {connected && ws ? (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                <p className="font-medium">
                  {ws.team_name || ws.team_id}
                </p>
                <p className="text-xs text-muted-foreground">
                  Team ID: {ws.team_id}
                </p>
                {ws.last_success_at ? (
                  <p className="text-xs text-muted-foreground">
                    Last success: {new Date(ws.last_success_at).toLocaleString()}
                  </p>
                ) : null}
                {ws.last_error ? (
                  <p className="text-xs text-destructive">{ws.last_error}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground">
                No Slack workspace linked to this company yet.
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {!connected ? (
                <Button
                  size="sm"
                  onClick={() => void connect()}
                  disabled={busy || !status?.platform_configured}
                >
                  <Plug className="mr-1 h-4 w-4" /> Connect Slack
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => ws && void disconnect(ws.id)}
                  disabled={busy}
                >
                  <Unplug className="mr-1 h-4 w-4" /> Disconnect
                </Button>
              )}
              <Button asChild size="sm" variant="ghost">
                <a
                  href="https://api.slack.com/apps"
                  target="_blank"
                  rel="noreferrer"
                >
                  Slack app settings <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default channel & test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="channel">Channel ID or #name</Label>
              <Input
                id="channel"
                placeholder="C0123ABCD or #ops-alerts"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                disabled={!connected}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="test">Test message</Label>
              <Input
                id="test"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                disabled={!connected}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {connected && ws ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void saveChannel(ws.id)}
                >
                  Save channel
                </Button>
              ) : null}
              <Button
                size="sm"
                disabled={busy || !connected}
                onClick={() => void sendTest()}
              >
                <Send className="mr-1 h-4 w-4" /> Send test
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              OAuth redirect URI must be registered in Slack:
              <br />
              <code className="text-[10px]">
                {"{APP_URL}"}/api/v2/integrations/slack/oauth/callback
              </code>
              <br />
              Events Request URL:
              <br />
              <code className="text-[10px]">
                {"{APP_URL}"}/api/v2/integrations/slack/events
              </code>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
