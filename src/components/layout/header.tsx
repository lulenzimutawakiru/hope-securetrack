"use client";

import { useRouter } from "next/navigation";
import { Moon, Sun, LogOut, User, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { CommandPalette } from "@/components/enterprise/command-palette";
import { LiveStatus } from "@/components/enterprise/live-status";
import { TenantSwitcher } from "@/components/layout/tenant-switcher";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/sidebar";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { toast } from "sonner";
import { useState } from "react";

export function Header({ title }: { title?: string }) {
  const { theme, setTheme } = useTheme();
  const { auth } = useUser();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = auth
    ? `${auth.profile.first_name[0] ?? ""}${auth.profile.last_name[0] ?? ""}`.toUpperCase()
    : "U";
  const avatarUrl = auth
    ? (auth.profile as { avatar_url?: string | null }).avatar_url
    : null;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-[var(--header-height)] items-center justify-between gap-2 border-b bg-card/90 px-3 sm:px-4 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="flex min-w-0 items-center gap-2">
        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(100%,18rem)] p-0 border-sidebar-border bg-sidebar">
            <Sidebar forceExpanded onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        {title ? (
          <h1 className="truncate text-base sm:text-lg font-semibold tracking-tight">
            {title}
          </h1>
        ) : (
          <div className="hidden sm:block min-w-0">
            <p className="text-overline leading-none">{APP_NAME}</p>
            <p className="text-sm font-semibold truncate">{APP_TAGLINE}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <TenantSwitcher />
        <CommandPalette />
        <LiveStatus />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          className="shrink-0"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full shrink-0">
              <Avatar className="h-9 w-9">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">
                  {auth
                    ? `${auth.profile.first_name} ${auth.profile.last_name}`
                    : "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {auth?.profile.email}
                </p>
                {auth?.profile.roles && (
                  <p className="text-xs text-brand font-medium">
                    {auth.profile.roles.name}
                  </p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/dashboard/settings/profile")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
              <User className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/dashboard/notifications")}>
              Notifications
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
