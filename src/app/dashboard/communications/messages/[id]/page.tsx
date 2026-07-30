"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, RotateCcw, RefreshCw, Mail, Paperclip, Activity, ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { getMessage, retryMessage, markMessageSent } from "@/lib/communications";
import { formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

export default function MessageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { auth } = useUser();
  const id = String(params?.id || "");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Record<string, unknown> | null>(null);
  const [attachments, setAttachments] = useState<Array<Record<string, unknown>>>([]);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getMessage(id);
      setMessage((data.message as Record<string, unknown>) || null);
      setAttachments((data.attachments as Array<Record<string, unknown>>) || []);
      setEvents((data.events as Array<Record<string, unknown>>) || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load message");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <LoadingState message="Loading message…" />;
  if (!message) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Message not found.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/communications/messages">Back to messages</Link>
        </Button>
      </div>
    );
  }

  const status = String(message.status || "");
  const to = (message.to_addresses as string[]) || [];
  const cc = (message.cc_addresses as string[]) || [];

  return (
    <div>
      <PageHeader
        title={String(message.subject || "(no subject)")}
        description={`${String(message.message_number)} · ${String(message.channel)} · created ${formatDate(String(message.created_at))}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button size="sm" variant="outline" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {(status === "failed" || status === "queued" || status === "draft") && (
              <Button
                size="sm"
                disabled={busy}
                onClick={async () => {
                  if (!auth) return;
                  setBusy(true);
                  try {
                    if (status === "failed") {
                      await retryMessage(id, auth.user.id);
                      toast.success("Retry queued");
                    } else {
                      await markMessageSent(id, auth.profile.company_id, auth.user.id);
                      toast.success("Marked sent");
                    }
                    await load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Action failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                {status === "failed" ? "Retry" : "Send now"}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6">
        <Badge variant={status === "failed" ? "destructive" : "default"}>{status}</Badge>
        <Badge variant="outline">{String(message.channel)}</Badge>
        <Badge variant="secondary">{String(message.priority || "normal")}</Badge>
        <Badge variant="outline">{String(message.category || "system")}</Badge>
        {message.source_module ? (
          <Badge variant="outline">{String(message.source_module)}</Badge>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4" /> Message body
              </CardTitle>
            </CardHeader>
            <CardContent>
              {message.body_html ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-muted/20 p-4"
                  dangerouslySetInnerHTML={{
                    __html: String(message.body_html)
                      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                      .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
                      .replace(/javascript:/gi, ""),
                  }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm rounded-lg border bg-muted/20 p-4">
                  {String(message.body_text || "—")}
                </pre>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" /> Delivery timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No delivery events yet.</p>
              ) : (
                <ol className="relative border-l border-border ml-2 space-y-4">
                  {events.map((ev) => (
                    <li key={String(ev.id)} className="ml-4">
                      <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-background bg-primary" />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{String(ev.event_type)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(String(ev.occurred_at || ev.created_at || ""))}
                        </span>
                      </div>
                      {ev.recipient ? (
                        <p className="text-xs text-muted-foreground mt-1">{String(ev.recipient)}</p>
                      ) : null}
                      {ev.details || ev.error_message ? (
                        <p className="text-xs mt-1">{String(ev.details || ev.error_message)}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recipients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">To</p>
                <p className="break-all">{to.length ? to.join(", ") : String(message.recipient_summary || "—")}</p>
              </div>
              {cc.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cc</p>
                  <p className="break-all">{cc.join(", ")}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {[
                ["Message #", message.message_number],
                ["Provider", message.provider || "—"],
                ["Provider ID", message.provider_message_id || "—"],
                ["Source event", message.source_event || "—"],
                ["Entity", message.entity_code || message.entity_type || "—"],
                ["Retries", message.retry_count ?? 0],
                ["Opens", message.open_count ?? 0],
                ["Clicks", message.click_count ?? 0],
                ["Sent", message.sent_at ? formatDateTime(String(message.sent_at)) : "—"],
                ["Delivered", message.delivered_at ? formatDateTime(String(message.delivered_at)) : "—"],
              ].map((row) => {
                const k = String(row[0]);
                const v = String(row[1] ?? "—");
                return (
                <div key={k} className="flex justify-between gap-2 border-b border-border/60 pb-1.5 last:border-0">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="text-right font-medium break-all">{v}</span>
                </div>
                );
              })}
              {message.error_message ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                  {String(message.error_message)}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Attachments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attachments.</p>
              ) : (
                attachments.map((a) => (
                  <div
                    key={String(a.id)}
                    className="flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{String(a.file_name)}</p>
                      <p className="text-[11px] text-muted-foreground">{String(a.doc_type)}</p>
                    </div>
                    {a.file_url ? (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={String(a.file_url)} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Drill paths</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <Link href="/dashboard/communications/messages" className="block text-primary hover:underline">
                ← All messages
              </Link>
              <Link
                href={`/dashboard/communications/${String(message.channel) === "in_app" ? "in-app" : String(message.channel)}`}
                className="block text-primary hover:underline"
              >
                Channel: {String(message.channel)}
              </Link>
              <Link href="/dashboard/communications/deliveries" className="block text-primary hover:underline">
                Delivery reports
              </Link>
              <Link href="/dashboard/communications/templates" className="block text-primary hover:underline">
                Templates
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
