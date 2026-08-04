"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Send, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

type Status = {
  configured: boolean;
  provider: string;
  from: string | null;
  fromName: string | null;
  replyTo: string | null;
  envHints: Record<string, string>;
};

export default function EmailSettingsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [testTo, setTestTo] = useState("");
  const [sending, setSending] = useState(false);
  const [outbox, setOutbox] = useState<Array<Record<string, unknown>>>([]);
  const [compose, setCompose] = useState({
    to: "",
    subject: "",
    text: "",
  });

  const load = async () => {
    try {
      const res = await fetch("/api/email/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      /* ignore */
    }

    const supabase = createClient();
    const { data } = await supabase
      .from("email_outbox")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    setOutbox(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (auth?.profile.email) setTestTo(auth.profile.email);
    load();
  }, [auth]);

  const sendTest = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Test send failed", {
          description: data.hint,
        });
      } else {
        toast.success(`Test email sent to ${data.to}`, {
          description: `Resend id: ${data.id}`,
        });
        load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    } finally {
      setSending(false);
    }
  };

  const sendCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: compose.to,
          subject: compose.subject,
          text: compose.text,
        }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || "Send failed");
      else {
        toast.success("Email sent", { description: data.id });
        setCompose({ to: "", subject: "", text: "" });
        load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingState message="Loading email settings…" />;

  return (
    <div>
      <PageHeader
        title="Email & Resend"
        description="Transactional mail via Resend — notifications, tests, outbox log"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings">Hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings/notifications">Templates</Link>
            </Button>
            <Button size="sm" variant="secondary" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Provider status
            </CardTitle>
            <CardDescription>
              API keys stay in server environment (never stored in the database)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              {status?.configured ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <Badge className="bg-green-100 text-green-800">Resend configured</Badge>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <Badge variant="secondary">Not configured</Badge>
                </>
              )}
            </div>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Provider:</span>{" "}
                {status?.provider ?? "resend"}
              </p>
              <p>
                <span className="text-muted-foreground">From:</span>{" "}
                <span className="font-mono text-xs">{status?.from ?? "—"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Reply-To:</span>{" "}
                {status?.replyTo ?? "—"}
              </p>
            </div>
            <div className="rounded border bg-muted/40 p-3 text-xs space-y-1">
              <p className="font-medium">Environment variables</p>
              <ul className="font-mono text-[11px] text-muted-foreground space-y-0.5">
                <li>RESEND_API_KEY — {status?.envHints?.RESEND_API_KEY ?? "missing"}</li>
                <li>RESEND_FROM_EMAIL — {status?.envHints?.RESEND_FROM_EMAIL ?? "default"}</li>
                <li>RESEND_FROM_NAME — {status?.envHints?.RESEND_FROM_NAME ?? "default"}</li>
              </ul>
              <p className="pt-2 text-muted-foreground">
                Set these in Vercel → Project → Settings → Environment Variables, then redeploy.
                Verify your domain at{" "}
                <a
                  className="text-hope-teal underline"
                  href="https://resend.com/domains"
                  target="_blank"
                  rel="noreferrer"
                >
                  resend.com/domains
                </a>
                . For sandbox testing without a domain, use Resend’s onboarding sender.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send test email</CardTitle>
            <CardDescription>Verifies API key, from-address, and deliverability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Recipient</Label>
              <Input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <Button onClick={sendTest} disabled={sending || !status?.configured}>
              <Send className="h-4 w-4 mr-1" />
              {sending ? "Sending…" : "Send test"}
            </Button>
            {!status?.configured && (
              <p className="text-xs text-amber-700">
                Configure RESEND_API_KEY before sending.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Compose & send</CardTitle>
          <CardDescription>Direct transactional email (uses branded HTML wrapper)</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={sendCompose} className="grid gap-3 max-w-xl">
            <div className="space-y-1">
              <Label>To</Label>
              <Input
                type="email"
                required
                value={compose.to}
                onChange={(e) => setCompose((c) => ({ ...c, to: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Subject</Label>
              <Input
                required
                value={compose.subject}
                onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Body</Label>
              <textarea
                required
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={compose.text}
                onChange={(e) => setCompose((c) => ({ ...c, text: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={sending || !status?.configured}>
              Send email
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email outbox (recent)</CardTitle>
        </CardHeader>
        <CardContent>
          {outbox.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages logged yet.</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outbox.map((r) => (
                    <TableRow key={String(r.id)}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {r.created_at
                          ? new Date(String(r.created_at)).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono max-w-[140px] truncate">
                        {Array.isArray(r.to_addresses)
                          ? (r.to_addresses as string[]).join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {String(r.subject ?? "")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            r.status === "sent"
                              ? "bg-green-100 text-green-800"
                              : undefined
                          }
                          variant={r.status === "sent" ? "default" : "secondary"}
                        >
                          {String(r.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {String(r.provider_message_id ?? r.error_message ?? "—").slice(0, 24)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
