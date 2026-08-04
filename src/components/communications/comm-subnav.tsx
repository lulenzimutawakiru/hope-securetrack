"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Mail, MessageSquare, Smartphone, Bell, Radio, MessagesSquare,
  FileText, Send, Workflow, Megaphone, CalendarClock, Settings2,
  Sparkles, ScrollText, LayoutDashboard, Layers, Inbox, RotateCcw,
  BarChart3, Activity, ListOrdered,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { canAccessRoute } from "@/lib/auth/rbac";

const DRILL = [
  { title: "Hub", href: "/dashboard/communications", icon: LayoutDashboard, exact: true },
  { title: "All messages", href: "/dashboard/communications/messages", icon: ListOrdered },
  { title: "Compose", href: "/dashboard/communications/compose", icon: Send },
  { title: "Email", href: "/dashboard/communications/email", icon: Mail },
  { title: "SMS", href: "/dashboard/communications/sms", icon: MessageSquare },
  { title: "WhatsApp", href: "/dashboard/communications/whatsapp", icon: Smartphone },
  { title: "Push", href: "/dashboard/communications/push", icon: Radio },
  { title: "In-app", href: "/dashboard/communications/in-app", icon: Bell },
  { title: "SecureChat", href: "/dashboard/communications/hopechat", icon: MessagesSquare },
  { title: "Documents", href: "/dashboard/communications/documents", icon: FileText },
  { title: "Templates", href: "/dashboard/communications/templates", icon: Layers },
  { title: "Rules", href: "/dashboard/communications/rules", icon: Workflow },
  { title: "Campaigns", href: "/dashboard/communications/campaigns", icon: Megaphone },
  { title: "Scheduled", href: "/dashboard/communications/scheduled", icon: CalendarClock },
  { title: "Retry", href: "/dashboard/communications/retry", icon: RotateCcw },
  { title: "Deliveries", href: "/dashboard/communications/deliveries", icon: Inbox },
  { title: "Analytics", href: "/dashboard/communications/analytics", icon: BarChart3 },
  { title: "Live", href: "/dashboard/communications/live", icon: Activity },
  { title: "AI", href: "/dashboard/communications/ai", icon: Sparkles },
  { title: "Providers", href: "/dashboard/communications/providers", icon: Settings2 },
  { title: "Audit", href: "/dashboard/communications/audit", icon: ScrollText },
] as const;

export function CommSubnav() {
  const pathname = usePathname() || "";
  const { auth, isPlatformAdmin } = useUser();

  return (
    <div className="mb-5 -mx-1">
      <div className="flex items-center gap-2 px-1 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Communications
        </p>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 px-1 scrollbar-thin">
        {DRILL.filter((item) => canAccessRoute(auth?.permissions, item.href, { isPlatformAdmin })).map((item) => {
          const exact = "exact" in item && item.exact;
          const active = exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
                  : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.title}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
