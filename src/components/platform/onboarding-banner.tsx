"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Rocket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";

const DISMISS_KEY = "securetrack.setup_banner_dismissed";

/**
 * Shows a compact go-live banner when tenant setup is incomplete.
 * Dismissed per-browser for 7 days (localStorage).
 */
export function OnboardingBanner() {
  const { auth, loading } = useUser();
  const [visible, setVisible] = useState(false);
  const [percent, setPercent] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (loading || !auth?.tenantId) {
      setVisible(false);
      return;
    }

    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const until = Number(raw);
        if (Number.isFinite(until) && until > Date.now()) {
          setVisible(false);
          return;
        }
      }
    } catch {
      /* private mode */
    }

    let cancelled = false;
    fetch("/api/v2/platform/setup")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const data = json?.data ?? json;
        const summary = data?.summary;
        if (
          summary &&
          !summary.isComplete &&
          summary.total > 0 &&
          summary.remaining > 0
        ) {
          setPercent(summary.percent ?? 0);
          setRemaining(summary.remaining ?? 0);
          setVisible(true);
        } else {
          setVisible(false);
        }
      })
      .catch(() => {
        if (!cancelled) setVisible(false);
      });

    return () => {
      cancelled = true;
    };
  }, [auth?.tenantId, loading]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(
        DISMISS_KEY,
        String(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div
      role="status"
      className="border-b border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 sm:px-4"
    >
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-amber-950 dark:text-amber-100 min-w-0">
          <Rocket className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <span className="truncate">
            Finish go-live setup —{" "}
            <strong>
              {percent}% done, {remaining} step{remaining === 1 ? "" : "s"} left
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
            <Link href="/dashboard/settings/setup">Continue setup</Link>
          </Button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded p-1 text-amber-800/70 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/50"
            aria-label="Dismiss setup banner for 7 days"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
