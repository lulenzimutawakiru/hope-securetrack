"use client";

import { Archive, Download, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  count: number;
  onClear: () => void;
  onExport?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  className?: string;
  label?: string;
};

export function BulkActionBar({
  count,
  onClear,
  onExport,
  onArchive,
  onRestore,
  onDelete,
  className,
  label = "selected",
}: Props) {
  if (count <= 0) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-card/95 px-3 py-2 shadow-enterprise backdrop-blur supports-[backdrop-filter]:bg-card/90",
        className
      )}
      role="toolbar"
      aria-label="Bulk actions"
    >
      <span className="text-sm font-medium tabular-nums">
        {count} {label}
      </span>
      <div className="h-4 w-px bg-border mx-1 hidden sm:block" />
      {onExport && (
        <Button size="sm" variant="outline" onClick={onExport}>
          <Download className="h-3.5 w-3.5 mr-1" />
          Export
        </Button>
      )}
      {onArchive && (
        <Button size="sm" variant="outline" onClick={onArchive}>
          <Archive className="h-3.5 w-3.5 mr-1" />
          Archive
        </Button>
      )}
      {onRestore && (
        <Button size="sm" variant="outline" onClick={onRestore}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Restore
        </Button>
      )}
      {onDelete && (
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Delete
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={onClear} className="ml-auto">
        <X className="h-3.5 w-3.5 mr-1" />
        Clear
      </Button>
    </div>
  );
}
