"use client";

import { X, Pin, PinOff } from "lucide-react";
import { useWorkspaceTabs } from "@/hooks/use-workspace-tabs";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WorkspaceTabs() {
  const { tabs, activeHref, openTab, closeTab, togglePin, closeOthers, ready } =
    useWorkspaceTabs();

  if (!ready) return null;

  return (
    <div className="hidden sm:flex items-center gap-0.5 border-b bg-muted/30 px-2 overflow-x-auto no-scrollbar min-h-9">
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        return (
          <div
            key={tab.href}
            className={cn(
              "group flex items-center gap-1 max-w-[11rem] shrink-0 rounded-t-md border border-b-0 px-2 py-1.5 text-xs transition-colors",
              active
                ? "bg-background border-border text-foreground shadow-sm"
                : "border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground"
            )}
          >
            <button
              type="button"
              className="truncate font-medium text-left min-w-0 flex-1"
              onClick={() => openTab(tab.href)}
              title={tab.title}
            >
              {tab.pinned && (
                <Pin className="inline h-3 w-3 mr-1 text-accent align-text-bottom" />
              )}
              {tab.title}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted"
                  aria-label="Tab menu"
                >
                  <span className="text-[10px] leading-none">▾</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuItem onClick={() => togglePin(tab.href)}>
                  {tab.pinned ? (
                    <>
                      <PinOff className="h-3.5 w-3.5 mr-2" /> Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="h-3.5 w-3.5 mr-2" /> Pin tab
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => closeOthers(tab.href)}>
                  Close others
                </DropdownMenuItem>
                {!tab.pinned && (
                  <DropdownMenuItem onClick={() => closeTab(tab.href)}>
                    <X className="h-3.5 w-3.5 mr-2" /> Close
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {!tab.pinned && (
              <button
                type="button"
                className="opacity-60 hover:opacity-100 p-0.5 rounded hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.href);
                }}
                aria-label={`Close ${tab.title}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
