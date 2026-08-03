"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Inbox, Send, Mail, PhoneCall, MessageCircle, Search,
  ArrowLeft, MessageSquareText, PlusCircle, Cpu, Wifi,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { cn, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";
import { convertInboundToTicket, postMessage } from "@/lib/service-desk";

type SdMessage = {
  id: string;
  channel?: string | null;
  direction?: string | null;
  author_name?: string | null;
  body?: string | null;
  is_public?: boolean | null;
  created_at?: string | null;
};

type ConversationItem = {
  id: string;
  kind: "ticket" | "inbound";
  source: string;
  subject: string;
  body: string;
  from: string;
  status: string;
  priority: string;
  created_at: string;
  messages: SdMessage[];
};

const CHANNEL_FILTERS = [
  { key: "all", label: "All", icon: Inbox },
  { key: "email", label: "Email", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "chat", label: "Chat", icon: MessageSquareText },
  { key: "phone", label: "Phone", icon: PhoneCall },
  { key: "teams", label: "Teams", icon: MessageSquareText },
  { key: "slack", label: "Slack", icon: MessageSquareText },
  { key: "iot", label: "IoT", icon: Wifi },
  { key: "api", label: "API", icon: Cpu },
];

export default function ConversationsPage() {
  const { auth } = useUser();
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;
  const displayName =
    auth?.profile && auth.profile.first_name
      ? `${auth.profile.first_name} ${auth.profile.last_name}`.trim()
      : "Agent";

  const load = async () => {
    const supabase = createClient();
    const [ticketsRes, inboundRes] = await Promise.all([
      supabase
        .from("support_tickets")
        .select(
          "id,ticket_number,subject,status,priority,channel,requester_name,created_at," +
            "sd_messages(id,channel,direction,author_name,body,created_at,is_public)"
        )
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("sd_inbound_items")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(80),
    ]);

    const tickets = (ticketsRes.data as unknown as Array<Record<string, unknown>>) || [];
    const inbound = (inboundRes.data as Array<Record<string, unknown>>) || [];

    const ticketItems: ConversationItem[] = tickets.map((t) => ({
      id: String(t.id),
      kind: "ticket",
      source: String(t.channel || "web"),
      subject: String(t.subject || "(no subject)"),
      body: "",
      from: String(t.requester_name || "Requester"),
      status: String(t.status || "new"),
      priority: String(t.priority || ""),
      created_at: String(t.created_at || ""),
      messages: (t.sd_messages as SdMessage[] | null) || [],
    }));

    const inboundItems: ConversationItem[] = inbound
      .filter((i) => {
        const s = String(i.status || "new");
        return s !== "ignored" && s !== "spam";
      })
      .map((i) => ({
        id: String(i.id),
        kind: "inbound",
        source: String(i.source || "email"),
        subject: String(i.subject || "(no subject)"),
        body: String(i.body || ""),
        from: String(i.from_address || "Unknown sender"),
        status: String(i.status || "new"),
        priority: "",
        created_at: String(i.received_at || i.created_at || ""),
        messages: [],
      }));

    const all = [...ticketItems, ...inboundItems].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
    setItems(all);
    setSelectedId((prev) =>
      prev && all.some((x) => x.id === prev) ? prev : all.length > 0 ? all[0].id : null
    );
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== "all" && it.source !== filter) return false;
      if (!q) return true;
      return (
        it.subject.toLowerCase().includes(q) ||
        it.body.toLowerCase().includes(q) ||
        it.from.toLowerCase().includes(q)
      );
    });
  }, [items, filter, query]);

  const selected = items.find((it) => it.id === selectedId) || null;

  const convert = async (id: string) => {
    if (!companyId) return;
    setBusy(true);
    try {
      const t = await convertInboundToTicket({
        company_id: companyId,
        inbound_id: id,
        created_by: userId,
      });
      toast.success(`Ticket ${t.ticket_number} created`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const ignore = async (id: string) => {
    setBusy(true);
    try {
      await crudUpdate("sd_inbound_items", id, { status: "ignored" });
      toast.success("Ignored");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!companyId || !selected || !reply.trim()) return;
    setBusy(true);
    try {
      let ticketId = selected.id;
      if (selected.kind === "inbound") {
        const t = await convertInboundToTicket({
          company_id: companyId,
          inbound_id: selected.id,
          created_by: userId,
        });
        ticketId = t.id;
        toast.success(`Ticket ${t.ticket_number} created`);
      }
      await postMessage({
        company_id: companyId,
        ticket_id: ticketId,
        body: reply.trim(),
        channel: ["web", "portal"].includes(selected.source)
          ? "internal"
          : selected.source || "internal",
        is_public: true,
        author_id: userId,
        author_name: displayName,
      });
      setReply("");
      toast.success("Reply sent");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const renderMessages = (item: ConversationItem) => {
    if (item.kind === "inbound") {
      return (
        <div className="space-y-3">
          <div className="max-w-[85%] rounded-lg border bg-background p-3 mr-auto">
            <div className="text-xs font-medium mb-1">{item.from}</div>
            <div className="text-sm whitespace-pre-wrap">{item.body}</div>
          </div>
          {item.status === "new" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => convert(item.id)} disabled={busy}>
                <PlusCircle className="h-4 w-4 mr-1" /> Create ticket
              </Button>
              <Button size="sm" variant="ghost" onClick={() => ignore(item.id)} disabled={busy}>
                Ignore
              </Button>
            </div>
          )}
        </div>
      );
    }
    if (item.messages.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No messages on this conversation yet. Reply below to start the thread.
        </p>
      );
    }
    return (
      <div className="space-y-3">
        {item.messages.map((m) => {
          const dir = String(m.direction || "outbound");
          const isPublic = m.is_public !== false;
          if (dir === "system") {
            return (
              <div key={String(m.id)} className="text-center text-xs text-muted-foreground py-1">
                {String(m.body || "")}
              </div>
            );
          }
          return (
            <div
              key={String(m.id)}
              className={cn(
                "max-w-[85%] rounded-lg border p-3",
                dir === "inbound" ? "bg-background mr-auto" : "bg-primary text-primary-foreground ml-auto",
                !isPublic && "border-amber-500/40 bg-background text-foreground ml-auto"
              )}
            >
              <div className="text-xs font-medium mb-1 flex items-center gap-2">
                <span>{m.author_name || (dir === "inbound" ? "Customer" : "Agent")}</span>
                {!isPublic && (
                  <Badge variant="secondary" className="text-[9px]">Internal note</Badge>
                )}
                {m.created_at && (
                  <span className="text-[10px] opacity-70 ml-auto">{formatDateTime(String(m.created_at))}</span>
                )}
              </div>
              <div className="text-sm whitespace-pre-wrap">{String(m.body || "")}</div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) return <LoadingState message="Loading conversations…" />;

  return (
    <div>
      <PageHeader
        title="Unified Conversations"
        description="Omnichannel inbox · email · WhatsApp · chat · phone · IoT · AI-assisted replies"
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="rounded-md border overflow-hidden flex flex-col">
          <div className="p-3 border-b space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {CHANNEL_FILTERS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFilter(c.key)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    filter === c.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  <c.icon className="h-3 w-3" />
                  {c.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search conversations…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto max-h-[65vh]">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No conversations"
                description="Try another channel filter or search term."
                className="m-3"
              />
            ) : (
              filtered.map((it) => {
                const active = selectedId === it.id;
                const unread = it.messages.filter((m) => m.direction === "inbound").length;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setSelectedId(it.id)}
                    className={cn(
                      "w-full text-left border-b px-3 py-2.5 transition-colors hover:bg-muted/60",
                      active && "bg-muted/80"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{it.from}</span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {it.created_at ? formatDateTime(it.created_at) : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[9px] capitalize">{it.source}</Badge>
                      {it.priority && (
                        <Badge variant="secondary" className="text-[9px] capitalize">{it.priority}</Badge>
                      )}
                      {Boolean(unread) && <span className="ml-auto h-2 w-2 rounded-full bg-hope-teal" />}
                    </div>
                    <div className="text-sm font-medium truncate mt-1">{it.subject}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-md border flex flex-col min-h-[65vh]">
          {!selected ? (
            <EmptyState
              icon={MessageSquareText}
              title="Select a conversation"
              description="Pick a thread from the left to view and reply."
            />
          ) : (
            <>
              <div className="border-b p-3 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{selected.subject}</div>
                  <div className="text-xs text-muted-foreground">
                    {selected.kind === "ticket" ? (
                      <span className="capitalize">{selected.status}</span>
                    ) : (
                      <span className="capitalize">{selected.source} inbound</span>
                    )}
                    {" "}·{" "}from {selected.from}
                  </div>
                </div>
                {selected.kind === "ticket" && (
                  <Badge variant="outline" className="text-[10px]">Ticket</Badge>
                )}
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-3 max-h-[46vh]">
                {renderMessages(selected)}
              </div>

              <div className="border-t p-3">
                <Textarea
                  placeholder="Type a reply…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="min-h-[80px]"
                />
                <div className="flex justify-end mt-2">
                  <Button size="sm" onClick={sendReply} disabled={busy || !reply.trim()}>
                    <Send className="h-4 w-4 mr-1" /> Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}