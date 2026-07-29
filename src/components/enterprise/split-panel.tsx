"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  left: ReactNode;
  right: ReactNode;
  /** Initial left width % */
  defaultLeftPct?: number;
  minLeftPct?: number;
  maxLeftPct?: number;
  className?: string;
  storageKey?: string;
  orientation?: "horizontal" | "vertical";
};

export function SplitPanel({
  left,
  right,
  defaultLeftPct = 50,
  minLeftPct = 22,
  maxLeftPct = 78,
  className,
  storageKey,
  orientation = "horizontal",
}: Props) {
  const [pct, setPct] = useState(() => {
    if (typeof window !== "undefined" && storageKey) {
      const v = Number(localStorage.getItem(storageKey));
      if (v >= minLeftPct && v <= maxLeftPct) return v;
    }
    return defaultLeftPct;
  });
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMove = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el || !dragging.current) return;
      const rect = el.getBoundingClientRect();
      let next: number;
      if (orientation === "horizontal") {
        next = ((clientX - rect.left) / rect.width) * 100;
      } else {
        next = ((clientY - rect.top) / rect.height) * 100;
      }
      next = Math.min(maxLeftPct, Math.max(minLeftPct, next));
      setPct(next);
      if (storageKey) localStorage.setItem(storageKey, String(Math.round(next)));
    },
    [maxLeftPct, minLeftPct, orientation, storageKey]
  );

  const startDrag = () => {
    dragging.current = true;
    document.body.style.cursor =
      orientation === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  const endDrag = () => {
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const isH = orientation === "horizontal";

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex w-full min-h-[280px] rounded-xl border bg-card overflow-hidden",
        isH ? "flex-row" : "flex-col",
        className
      )}
      onMouseMove={(e) => onMove(e.clientX, e.clientY)}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) onMove(t.clientX, t.clientY);
      }}
      onTouchEnd={endDrag}
    >
      <div
        className="min-w-0 min-h-0 overflow-auto"
        style={
          isH
            ? { width: `${pct}%` }
            : { height: `${pct}%`, width: "100%" }
        }
      >
        {left}
      </div>
      <div
        role="separator"
        aria-orientation={isH ? "vertical" : "horizontal"}
        aria-valuenow={Math.round(pct)}
        tabIndex={0}
        className={cn(
          "shrink-0 bg-border hover:bg-accent/40 active:bg-accent/50 transition-colors z-10",
          isH ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize w-full"
        )}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 5 : 2;
          if (isH) {
            if (e.key === "ArrowLeft") setPct((p) => Math.max(minLeftPct, p - step));
            if (e.key === "ArrowRight") setPct((p) => Math.min(maxLeftPct, p + step));
          } else {
            if (e.key === "ArrowUp") setPct((p) => Math.max(minLeftPct, p - step));
            if (e.key === "ArrowDown") setPct((p) => Math.min(maxLeftPct, p + step));
          }
        }}
      />
      <div className="min-w-0 min-h-0 flex-1 overflow-auto">{right}</div>
    </div>
  );
}
