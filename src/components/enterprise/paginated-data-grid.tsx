"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  EnterpriseDataGrid,
  type DataGridColumn,
} from "@/components/enterprise/data-grid";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { ModuleError } from "@/components/ui/module-error";

const PAGE_SIZES = [25, 50, 100];

export type PaginatedDataGridProps<T extends { id?: string }> = {
  /** Rows for the current page. */
  rows: T[];
  columns: DataGridColumn<T>[];
  /** Total record count (across all pages) returned by the server. */
  total: number;
  /** 1-based current page. */
  page: number;
  /** Rows per page. */
  pageSize: number;
  loading?: boolean;
  error?: Error | null;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  storageKey?: string;
  exportFilename?: string;
  emptyMessage?: string;
  toolbarExtra?: React.ReactNode;
  height?: number;
  enableSelection?: boolean;
  enableVirtual?: boolean;
  getRowId?: (row: T) => string;
  onSelectionChange?: (rows: T[]) => void;
  bulkArchive?: (rows: T[]) => void | Promise<void>;
  bulkRestore?: (rows: T[]) => void | Promise<void>;
  bulkDelete?: (rows: T[]) => void | Promise<void>;
};

/**
 * EnterpriseDataGrid wired to server-side pagination. Pairs with
 * useEntityList: the CRUD API returns { data, total, page, pageSize } which
 * this component renders with pager + page-size controls.
 */
export function PaginatedDataGrid<T extends { id?: string }>({
  rows,
  columns,
  total,
  page,
  pageSize,
  loading = false,
  error = null,
  onPageChange,
  onPageSizeChange,
  ...gridProps
}: PaginatedDataGridProps<T>) {
  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
    [total, pageSize]
  );

  if (error) {
    return <ModuleError error={error} title="Could not load data" />;
  }

  if (loading) {
    return <LoadingState message="Loading records..." />;
  }

  return (
    <div className="space-y-2">
      <EnterpriseDataGrid<T> data={rows} columns={columns} {...gridProps} />
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} record{total === 1 ? "" : "s"} · page {page}{" "}
          of {pageCount}
        </p>
        <div className="flex items-center gap-2">
          {onPageSizeChange && (
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="h-8 w-28 text-xs" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
