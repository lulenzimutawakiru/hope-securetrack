"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Hash, Lock, MessageSquare, Plus, Send, Pin, Smile,
  Sparkles, Ticket, CheckSquare, Phone, Video, Search, Users, Megaphone,
  Gauge, Bot, Bell,
  Paperclip, Settings, BookOpen, BarChart3, Home, Download, FileText,
  Edit3, Trash2, UserPlus, Loader2,
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
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  listChannels,
  getMessages,
  sendMessage,
  sendFileMessage,
  getSignedFileUrl,
  pinMessage,
  reactToMessage,
  createChannel,
  createChatTask,
  convertMessageToTicket,
  startDm,
  markChannelRead,
  ensureChannelMembership,
  editMessage,
  softDeleteMessage,
  listCompanyUsers,
  REACTIONS,
} from "@/lib/hopechat";
import { formatDateTime } from "@/lib/utils";

const SIDE_LINKS = [
  { href: "/dashboard/chat", label: "Chats", icon: MessageSquare },
  { href: "/dashboard/chat/executive", label: "Executive", icon: Gauge },
  { href: "/dashboard/chat/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/dashboard/chat/teams", label: "Teams", icon: Users },
  { href: "/dashboard/chat/meetings", label: "Meetings", icon: Video },
  { href: "/dashboard/chat/calls", label: "Calls", icon: Phone },
  { href: "/dashboard/chat/announcements", label: "Announce", icon: Megaphone },
  { href: "/dashboard/chat/files", label: "Files", icon: Paperclip },
  { href: "/dashboard/chat/ai-agent", label: "AI Agent", icon: Bot },
  { href: "/dashboard/chat/ai", label: "SecureTrackAI", icon: Sparkles },
  { href: "/dashboard/chat/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/dashboard/chat/search", label: "Search", icon: Search },
  { href: "/dashboard/chat/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/chat/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/chat/settings", label: "Settings", icon: Settings },
];

type ChatRow = Record<string, unknown>;
type CompanyUser = { id: string; name: string; email?: string | null };

/** Highlight @mentions and @emails in message bodies */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message);
  }
  return "";
}
function HighlightedText({ text }: { text: string }) {
  const parts = String(text || "").split(
    /(@[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|@(?:channel|here|all)\b|@[\w.-]+)/g
  );
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="text-primary font-medium">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function SecureChatPage() {
  const { auth } = useUser();
  const [channels, setChannels] = useState<Array<ChatRow>>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<ChatRow>>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [q, setQ] = useState("");
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [dmOpen, setDmOpen] = useState(false);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [typingPeers, setTypingPeers] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;
  const userName = auth?.profile
    ? `${(auth.profile as { first_name?: string }).first_name || ""} ${(auth.profile as { last_name?: string }).last_name || ""}`.trim() || "User"
    : "User";

  const { peers } = usePresence(activeId ? `hopechat:${activeId}` : "hopechat-global", !!auth);

  const loadChannels = useCallback(async () => {
    if (!companyId) return;
    const list = await listChannels(companyId, userId);
    setChannels(list as Array<ChatRow>);
    const unread: Record<string, number> = {};
    for (const c of list as Array<ChatRow>) {
      const lastRead = (c.membership as ChatRow | null)?.last_read_at as string | undefined;
      const lastMsg = c.last_message_at as string | undefined;
      if (lastMsg && (!lastRead || new Date(lastMsg) > new Date(lastRead))) {
        unread[String(c.id)] = 1;
      }
    }
    setUnreadMap((prev) => ({ ...unread, ...prev }));
    if (!activeId && list.length) {
      setActiveId(String(list[0].id));
    }
    setLoading(false);
  }, [companyId, userId, activeId]);

  const loadMessages = useCallback(async (channelId: string) => {
    const msgs = await getMessages(channelId);
    setMessages(msgs as Array<ChatRow>);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  // Mark channel read when opened
  useEffect(() => {
    if (activeId && userId) {
      markChannelRead({ channel_id: activeId, user_id: userId }).catch(() => {});
      if (companyId) {
        ensureChannelMembership({
          company_id: companyId,
          channel_id: activeId,
          user_id: userId,
        }).catch(() => {});
      }
      setUnreadMap((prev) => {
        const next = { ...prev };
        delete next[activeId];
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, userId, companyId]);

  useEffect(() => {
    loadChannels().catch(() => setLoading(false));
  }, [loadChannels]);

  useEffect(() => {
    if (activeId) loadMessages(activeId).catch(() => {});
  }, [activeId, loadMessages]);

  // Typing presence (per active channel)
  useEffect(() => {
    const supabase = createClient();
    const prev = typingChannelRef.current;
    if (prev) {
      prev.untrack().catch(() => {});
      supabase.removeChannel(prev);
      typingChannelRef.current = null;
    }
    setTypingPeers({});
    if (!activeId || !userId) return;

    const ch = supabase.channel(`hopechat:${activeId}:typing`, {
      config: { presence: { key: userId } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ user_id: string; name: string; typing?: boolean }>();
      const t: Record<string, string> = {};
      Object.values(state).forEach((arr) =>
        arr.forEach((u) => {
          if (u.typing && u.user_id !== userId) t[u.user_id] = u.name;
        })
      );
      setTypingPeers(t);
    }).subscribe((s) => {
      if (s === "SUBSCRIBED") {
        ch.track({ user_id: userId, name: userName, typing: false }).catch(() => {});
      }
    });
    typingChannelRef.current = ch;
    return () => {
      ch.untrack().catch(() => {});
      supabase.removeChannel(ch);
      if (typingChannelRef.current === ch) typingChannelRef.current = null;
    };
  }, [activeId, userId, userName]);

  const setTyping = useCallback(
    (typing: boolean) => {
      const ch = typingChannelRef.current;
      if (!ch || !userId) return;
      ch.track({ user_id: userId, name: userName, typing }).catch(() => {});
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      if (typing) {
        typingTimeoutRef.current = window.setTimeout(() => {
          ch.track({ user_id: userId, name: userName, typing: false }).catch(() => {});
        }, 2500);
      }
    },
    [userId, userName]
  );

  // Realtime: live insert / edit / delete
  useRealtimeTable({
    table: "hc_messages",
    event: "*",
    enabled: !!activeId,
    onChange: (payload) => {
      const row = (payload.new || null) as ChatRow | null;
      const oldRow = (payload.old || null) as ChatRow | null;
      const channelId = String((row?.channel_id || oldRow?.channel_id) || "");
      if (channelId !== activeId) {
        if (payload.eventType === "INSERT") {
          setUnreadMap((prev) => ({ ...prev, [channelId]: (prev[channelId] || 0) + 1 }));
        }
        return;
      }
      setMessages((prev) => {
        if (payload.eventType === "INSERT") {
          if (!row || prev.some((m) => m.id === row.id)) return prev;
          return [...prev, row];
        }
        if (payload.eventType === "UPDATE") {
          return prev.map((m) => (m.id === row?.id ? { ...m, ...row } : m));
        }
        if (payload.eventType === "DELETE") {
          return prev.filter((m) => m.id !== oldRow?.id);
        }
        return prev;
      });
      if (payload.eventType === "INSERT") {
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
      setTyping(false);
      await loadMessages(activeId);
    } catch (err) {
      toast.error(errorMessage(err) || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const pickFile = () => fileInputRef.current?.click();

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !companyId || !activeId) return;
    setUploading(true);
    try {
      await sendFileMessage({
        company_id: companyId,
        channel_id: activeId,
        sender_id: userId,
        sender_name: userName,
        file,
      });
      toast.success(`Sent ${file.name}`);
      await loadMessages(activeId);
    } catch (err) {
      toast.error(errorMessage(err) || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async (m: ChatRow) => {
    const meta = (m.metadata || {}) as Record<string, unknown>;
    const path = meta.storage_url as string | undefined;
    if (!path) {
      toast.error("No file attached to this message");
      return;
    }
    try {
      const url = await getSignedFileUrl(path);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.click();
    } catch (err) {
      toast.error(errorMessage(err) || "Download failed");
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

  const openDmPanel = async () => {
    setDmOpen((v) => !v);
    if (!users.length && companyId) {
      try {
        const u = await listCompanyUsers(companyId);
        setUsers(u.filter((x) => x.id !== userId));
      } catch {
        toast.error("Could not load people");
      }
    }
  };

  const startDmWith = async (u: CompanyUser) => {
    if (!companyId || !userId) return;
    try {
      const ch = await startDm({
        company_id: companyId,
        self_id: userId,
        self_name: userName,
        other_id: u.id,
        other_name: u.name,
      });
      setActiveId(String(ch.id));
      setDmOpen(false);
      await loadChannels();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start DM");
    }
  };

  const toTask = async (msg: ChatRow) => {
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

  const toTicket = async (msg: ChatRow) => {
    if (!companyId) return;
    try {
      const t = await convertMessageToTicket({
        company_id: companyId,
        message_id: String(msg.id),
        created_by: userId,
      });
      toast.success(`Ticket ${t.ticket_number} opened`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ticket failed - ensure Service Desk is available");
    }
  };

  const react = async (msgId: string, emoji: string) => {
    if (!companyId || !userId) return;
    await reactToMessage({ company_id: companyId, message_id: msgId, user_id: userId, emoji });
  };

  const beginEdit = (m: ChatRow) => {
    setEditingId(String(m.id));
    setEditText(String(m.body || ""));
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    try {
      await editMessage(editingId, editText.trim());
      setEditingId(null);
      setEditText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Edit failed");
    }
  };

  const removeMsg = async (m: ChatRow) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await softDeleteMessage(String(m.id));
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const filteredChannels = channels.filter((c) => {
    if (!q) return true;
    return String(c.name || "").toLowerCase().includes(q.toLowerCase());
  });

  const typingLine = Object.values(typingPeers);
  const isMine = (m: ChatRow) => userId && String(m.sender_id || "") === String(userId);

  if (loading) return <LoadingState message="Loading SecureChat..." />;

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
            placeholder="Search channels, people, messages..."
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
            <div className="flex items-center gap-0.5">
              <Button size="icon" variant="ghost" className="h-7 w-7" title="New direct message" onClick={openDmPanel}>
                <UserPlus className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="New channel" onClick={() => setNewChannelOpen((v) => !v)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {dmOpen && (
            <div className="border-b max-h-48 overflow-y-auto">
              <p className="px-3 pt-2 text-[11px] font-semibold text-muted-foreground">Start a direct message</p>
              {users.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Loading people...</p>
              ) : (
                users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => startDmWith(u)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/60 flex items-center gap-2"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                    <span className="truncate">{u.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
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
              const unread = unreadMap[String(c.id)] || 0;
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
                  <span className="truncate flex-1">{String(c.name)}</span>
                  {unread > 0 ? (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" title={`${unread} unread`} />
                  ) : null}
                </button>
              );
            })}
            {filteredChannels.length === 0 && (
              <p className="text-xs text-muted-foreground p-3">
                No channels. Create one or start a DM.
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
                  <Link href="/dashboard/chat/teams">Team</Link>
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((m) => {
                  const fileMeta = (m.metadata || {}) as Record<string, unknown>;
                  const isFile = m.message_type === "file";
                  return (
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
                        {isFile ? (
                          <Badge variant="secondary" className="text-[9px]">File</Badge>
                        ) : null}
                      </div>

                      {editingId === String(m.id) ? (
                        <div className="flex gap-2 mt-1">
                          <Input
                            autoFocus
                            className="h-8 text-sm"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                          <Button size="sm" className="h-8" onClick={saveEdit}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      ) : isFile ? (
                        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 mt-1 max-w-md">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm truncate flex-1">{String(m.body || "file")}</span>
                          <Button size="sm" variant="outline" className="h-7" onClick={() => downloadFile(m)}>
                            <Download className="h-3.5 w-3.5 mr-1" /> Download
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          <HighlightedText text={String(m.body || "")} />
                        </p>
                      )}

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
                        {isMine(m) && (
                          <>
                            <button
                              type="button"
                              className="text-[10px] px-1.5 rounded hover:bg-muted flex items-center gap-0.5"
                              onClick={() => beginEdit(m)}
                            >
                              <Edit3 className="h-3 w-3" /> Edit
                            </button>
                            <button
                              type="button"
                              className="text-[10px] px-1.5 rounded hover:bg-muted flex items-center gap-0.5"
                              onClick={() => removeMsg(m)}
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {typingLine.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {typingLine.slice(0, 3).join(", ")}
                    {typingLine.length > 3 ? ` +${typingLine.length - 3} more` : ""} typing...
                  </p>
                )}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={send} className="border-t p-3 bg-card">
                <div className="flex items-end gap-2 rounded-lg border bg-background p-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={onFileSelected}
                    disabled={uploading}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    title="Attach a file"
                    onClick={pickFile}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Emoji">
                    <Smile className="h-4 w-4" />
                  </Button>
                  <textarea
                    className="flex-1 min-h-[40px] max-h-32 resize-none bg-transparent text-sm outline-none px-1 py-2"
                    placeholder={`Message #${String(active.name)}  @name or @email to notify  @SecureTrackAI`}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setTyping(e.target.value.length > 0);
                    }}
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
                  Enter to send - Shift+Enter newline - Attach files - @mention notifies by email - Convert messages to Tasks or tickets
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