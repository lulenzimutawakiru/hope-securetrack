"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/marketing/logo";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "@/lib/marketing/data";

export function SiteHeader() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const headerClassName = isHome
    ? cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-white/10 bg-hope-blue/95 shadow-lg shadow-hope-indigo/10 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )
    : "sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur-xl";

  const navLinkClassName = (active: boolean) =>
    cn(
      "rounded-lg px-3 py-2 text-sm font-medium transition",
      isHome
        ? active
          ? "bg-white/15 text-white"
          : "text-white/85 hover:bg-white/10 hover:text-white"
        : active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
    );

  return (
    <header className={headerClassName}>
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="SecureTrack ERP home">
          <Logo light={isHome} />
        </Link>

        <nav className="hidden items-center gap-1 xl:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={navLinkClassName(pathname === link.href)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border transition",
              isHome
                ? "border-white/25 text-white/85 hover:bg-white/10 hover:text-white"
                : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
            aria-label={mounted && resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {mounted && resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <Link href="/login" className="hidden sm:block">
            <Button
              variant="ghost"
              size="sm"
              className={cn(isHome && "text-white hover:bg-white/10 hover:text-white")}
            >
              Login
            </Button>
          </Link>
          <Link href="/register">
            <Button
              size="sm"
              className={cn(
                "hidden sm:inline-flex",
                isHome &&
                  "bg-white font-bold text-hope-blue shadow-md shadow-hope-indigo/20 hover:bg-white/90",
              )}
            >
              Start Free Trial
            </Button>
          </Link>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "xl:hidden",
                  isHome && "border-white/25 bg-transparent text-white hover:bg-white/10",
                )}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto">
              <SheetHeader className="text-left">
                <SheetTitle className="flex items-center gap-2">
                  <Logo markClassName="h-6 w-6" />
                </SheetTitle>
                <SheetDescription>Explore the platform.</SheetDescription>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3">
                  <Link href="/careers" className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground">
                    Careers
                  </Link>
                  <Link href="/contact" className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground">
                    Contact
                  </Link>
                </div>
                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                  <Link href="/login">
                    <Button variant="outline" className="w-full">
                      Login
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button className="w-full">Start Free Trial</Button>
                  </Link>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
