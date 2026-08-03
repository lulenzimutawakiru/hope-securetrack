"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Hash, Lock, MessageSquare, Plus, Send, Pin, Smile,
  Sparkles, Ticket, CheckSquare, Phone, Video, Search, Users, Megaphone,
  Paperclip, Settings, BookOpen, BarChart3, Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { useRealtimeTable } from "@/hooks/use-realtime";
import { usePresence } from "@/hooks/use-presence";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listChannels,
  getMessages,
  sendMessage,
  pinMessage,
  reactToMessage,
  createChannel,
  createChatTask,
  convertMessageToTicket,
  REACTIONS,
} from "@/lib/hopechat";
import { formatDateTime } from "@/lib/utils";

const SIDE_LINKS = [
  { href: "/dashboard/chat", label: "Chats", icon: MessageSquare },
  { href: "/dashboard/chat/teams", label: "Teams", icon: Users },
  { href: "/dashboard/chat/meetings", label: "Meetings", icon: Video },
  { href: "/dashboard/chat/calls", label: "Calls", icon: Phone },
  { href: "/dashboard/chat/announcements", label: "Announce", icon: Megaphone },
  { href: "/dashboard/chat/files", label: "Files", icon: Paperclip },
  { href: "/dashboard/chat/ai", label: "SecureTrackAI", icon: Sparkles },
  { href: "/dashboard/chat/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/dashboard/chat/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/chat/settings", label: "Settings", icon: Settings },
];

export default function SecureChatPage() {
  const { auth } = useUser();
  const [channels, setChannels] = useState<Array<Record<string, unknown>>>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState("");
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;
  const userName = auth?.profile
    ? `${(auth.profile as { first_name?: string }).first_name || ""} ${(auth.profile as { last_name?: string }).last_name || ""}`.trim() || "User"
    : "User";

  const { peers } = usePresence(activeId ? `hopechat:${activeId}` : "hopechat-global", !!auth);

  const loadChannels = useCallback(async () => {
    if (!companyId) return;
    const list = await listChannels(companyId, userId);
    setChannels(list as Array<Record<string, unknown>>);
    if (!activeId && list.length) {
      setActiveId(String(list[0].id));
    }
    setLoading(false);
  }, [companyId, userId, activeId]);

  const loadMessages = useCallback(async (channelId: string) => {
    const msgs = await getMessages(channelId);
    setMessages(msgs as Array<Record<string, unknown>>);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => {
    loadChannels().catch(() => setLoading(false));
  }, [loadChannels]);

  useEffect(() => {
    if (activeId) loadMessages(activeId).catch(() => {});
  }, [activeId, loadMessages]);

  // Realtime new messages
  useRealtimeTable({
    table: "hc_messages",
    event: "INSERT",
    enabled: !!activeId,
    onChange: (payload) => {
      const row = payload.new as Record<string, unknown>;
      if (row && String(row.channel_id) === activeId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          return [...prev, row];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
      }
    },
  });

  const active = channels.find((c) => String(c.id) === activeId);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!companyId || !activeId || !text.trim()) return;
    setSending(true);
    try {
      await sendMessage({
        company_id: companyId,
        channel_id: activeId,
        sender_id: userId,
        sender_name: userName,
        message: { body: text },
      });
      setText("");
      await loadMessages(activeId);
      await loadChannels();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const createCh = async () => {
    if (!companyId || !newChannelName.trim()) return;
    try {
      const ch = await createChannel({
        company_id: companyId,
        name: newChannelName.trim(),
        channel_type: "channel",
        created_by: userId,
        member_ids: userId ? [userId] : [],
      });
      toast.success(`Created #${ch.slug || ch.name}`);
      setNewChannelName("");
      setNewChannelOpen(false);
      setActiveId(ch.id);
      await loadChannels();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const toTask = async (msg: Record<string, unknown>) => {
    if (!companyId) return;
    try {
      await createChatTask({
        company_id: companyId,
        title: String(msg.body || "").slice(0, 120),
        channel_id: activeId,
        message_id: String(msg.id),
        created_by: userId,
      });
      toast.success("Task created from message");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const toTicket = async (msg: Record<string, unknown>) => {
    if (!companyId) return;
    try {
      const t = await convertMessageToTicket({
        company_id: companyId,
        message_id: String(msg.id),
        created_by: userId,
      });
      toast.success(`Ticket ${t.ticket_number} opened`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ticket failed — ensure Service Desk is available");
    }
  };

  const react = async (msgId: string, emoji: string) => {
    if (!companyId || !userId) return;
    await reactToMessage({
      company_id: companyId,
      message_id: msgId,
      user_id: userId,
      emoji,
    });
    toast.success(emoji);
  };

  const filteredChannels = channels.filter((c) => {
    if (!q) return true;
    return String(c.name || "").toLowerCase().includes(q.toLowerCase());
  });

  if (loading) return <LoadingState message="Loading SecureChat…" />;

  return (
    <div className="-m-4 md:-m-6 h-[calc(100vh-4rem)] flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b px-3 py-2 bg-card shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
          <MessageSquare className="h-5 w-5" />
          <span className="hidden sm:inline">SecureChat</span>
        </Link>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            placeholder="Search channels, people, messages…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Badge variant="outline" className="text-[10px] hidden md:inline-flex">
          {peers.length} online
        </Badge>
        <Button asChild size="sm" variant="ghost">
          <Link href="/dashboard"><Home className="h-4 w-4" /></Link>
        </Button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Icon rail */}
        <nav className="hidden md:flex w-14 flex-col items-center gap-1 border-r py-2 bg-muted/30">
          {SIDE_LINKS.map((l) => (
            <Link
              key={l.href + l.label}
              href={l.href}
              title={l.label}
              className={cn(
                "p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
                l.href === "/dashboard/chat" && "bg-primary/10 text-primary"
              )}
            >
              <l.icon className="h-5 w-5" />
            </Link>
          ))}
        </nav>

        {/* Channel list */}
        <aside className="w-56 sm:w-64 border-r flex flex-col bg-card shrink-0">
          <div className="p-3 flex items-center justify-between border-b">
            <p className="text-sm font-semibold">Channels</p>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setNewChannelOpen((v) => !v)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {newChannelOpen && (
            <div className="p-2 border-b flex gap-1">
              <Input
                className="h-8 text-xs"
                placeholder="channel-name"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCh()}
              />
              <Button size="sm" className="h-8" onClick={createCh}>Add</Button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-1">
            {filteredChannels.map((c) => {
              const isDm = c.channel_type === "dm";
              const Icon = c.is_private || isDm ? Lock : Hash;
              return (
                <button
                  key={String(c.id)}
                  type="button"
                  onClick={() => setActiveId(String(c.id))}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left hover:bg-muted/60",
                    activeId === c.id && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{String(c.name)}</span>
                </button>
              );
            })}
            {filteredChannels.length === 0 && (
              <p className="text-xs text-muted-foreground p-3">
                No channels. Apply migration 00043 or create one.
              </p>
            )}
          </div>
          <div className="p-2 border-t text-[10px] text-muted-foreground">
            {peers.slice(0, 5).map((p) => (
              <div key={p.user_id} className="flex items-center gap-1.5 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Main conversation */}
        <main className="flex-1 flex flex-col min-w-0">
          {active ? (
            <>
              <div className="flex items-center gap-2 border-b px-4 py-2 bg-card">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{String(active.name)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {String(active.description || active.topic || active.channel_type)}
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild className="hidden sm:inline-flex">
                  <Link href="/dashboard/chat/meetings"><Video className="h-3.5 w-3.5 mr-1" /> Meet</Link>
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link href="/dashboard/chat/ai"><Sparkles className="h-4 w-4" /></Link>
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((m) => (
                  <div
                    key={String(m.id)}
                    className={cn(
                      "group rounded-lg px-3 py-2 hover:bg-muted/40 max-w-3xl",
                      m.message_type === "bot" && "border border-primary/20 bg-primary/5",
                      m.message_type === "system" && "bg-muted/50 text-sm",
                      m.message_type === "announcement" && "border-l-4 border-amber-500"
                    )}
                  >
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="font-semibold text-sm">
                        {String(m.sender_name || "System")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDateTime(String(m.created_at))}
                      </span>
                      {m.is_edited ? (
                        <span className="text-[10px] text-muted-foreground">(edited)</span>
                      ) : null}
                      {m.is_pinned ? <Pin className="h-3 w-3 text-primary" /> : null}
                      {m.message_type === "bot" ? (
                        <Badge variant="secondary" className="text-[9px]">Bot</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{String(m.body || "")}</p>
                    <div className="opacity-0 group-hover:opacity-100 flex flex-wrap gap-1 mt-1 transition">
                      {REACTIONS.slice(0, 4).map((e) => (
                        <button
                          key={e}
                          type="button"
                          className="text-xs px-1 rounded hover:bg-muted"
                          onClick={() => react(String(m.id), e)}
                        >
                          {e}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="text-[10px] px-1.5 rounded hover:bg-muted flex items-center gap-0.5"
                        onClick={() => pinMessage(String(m.id), true)}
                      >
                        <Pin className="h-3 w-3" /> Pin
                      </button>
                      <button
                        type="button"
                        className="text-[10px] px-1.5 rounded hover:bg-muted flex items-center gap-0.5"
                        onClick={() => toTask(m)}
                      >
                        <CheckSquare className="h-3 w-3" /> Task
                      </button>
                      <button
                        type="button"
                        className="text-[10px] px-1.5 rounded hover:bg-muted flex items-center gap-0.5"
                        onClick={() => toTicket(m)}
                      >
                        <Ticket className="h-3 w-3" /> Ticket
                      </button>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={send} className="border-t p-3 bg-card">
                <div className="flex items-end gap-2 rounded-lg border bg-background p-2">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Emoji">
                    <Smile className="h-4 w-4" />
                  </Button>
                  <textarea
                    className="flex-1 min-h-[40px] max-h-32 resize-none bg-transparent text-sm outline-none px-1 py-2"
                    placeholder={`Message #${String(active.name)} · @SecureTrackAI · /hr /it /prod`}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                  />
                  <Button type="submit" size="sm" disabled={sending || !text.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 px-1">
                  Enter to send · Shift+Enter newline · Convert messages to Tasks or Service Desk tickets
                </p>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select or create a channel to start collaborating.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
