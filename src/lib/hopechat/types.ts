/** SecureChat enterprise collaboration types */

export const CHANNEL_TYPES = [
  { value: "dm", label: "Direct Message" },
  { value: "group", label: "Group Chat" },
  { value: "channel", label: "Team Channel" },
  { value: "private", label: "Private Channel" },
  { value: "announcement", label: "Announcements" },
  { value: "project", label: "Project" },
  { value: "department", label: "Department" },
  { value: "bot", label: "Bot" },
] as const;

export const MESSAGE_TYPES = [
  "text",
  "file",
  "system",
  "voice",
  "poll",
  "task",
  "announcement",
  "bot",
] as const;

export const REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "✅", "🔥", "👏"] as const;

export const BOT_DOMAINS = [
  { value: "hr", label: "HR Bot", trigger: "/hr" },
  { value: "finance", label: "Finance Bot", trigger: "/finance" },
  { value: "production", label: "Production Bot", trigger: "/prod" },
  { value: "it", label: "IT Bot", trigger: "/it" },
  { value: "general", label: "SecureTrackAI", trigger: "@SecureTrackAI" },
] as const;

export const NAV_SECTIONS = [
  { title: "Home", href: "/dashboard/chat", icon: "Home" },
  { title: "Chats", href: "/dashboard/chat", icon: "MessageSquare" },
  { title: "Teams", href: "/dashboard/chat/teams", icon: "Users" },
  { title: "Meetings", href: "/dashboard/chat/meetings", icon: "Video" },
  { title: "Calls", href: "/dashboard/chat/calls", icon: "Phone" },
  { title: "Announcements", href: "/dashboard/chat/announcements", icon: "Megaphone" },
  { title: "Files", href: "/dashboard/chat/files", icon: "Paperclip" },
  { title: "SecureTrackAI", href: "/dashboard/chat/ai", icon: "Sparkles" },
  { title: "Knowledge", href: "/dashboard/chat/knowledge", icon: "BookOpen" },
  { title: "Analytics", href: "/dashboard/chat/analytics", icon: "BarChart3" },
  { title: "Settings", href: "/dashboard/chat/settings", icon: "Settings" },
] as const;

export interface ChatMessageInput {
  body: string;
  message_type?: string;
  reply_to_id?: string | null;
  metadata?: Record<string, unknown>;
}
