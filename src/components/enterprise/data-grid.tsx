"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnPinningState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Download,
  Pin,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { BulkActionBar } from "@/components/enterprise/bulk-action-bar";
import { downloadCsv } from "@/lib/documents";
import { cn } from "@/lib/utils";

export type DataGridColumn<T> = ColumnDef<T, unknown> & {
  /** Enable text filter for this column */
  enableColumnFilter?: boolean;
  /** Sticky pin left by default */
  defaultPinned?: "left" | "right" | false;
};

type Props<T extends { id?: string }> = {
  data: T[];
  columns: DataGridColumn<T>[];
  /** Persist filter/visibility under this key (localStorage) */
  storageKey?: string;
  height?: number;
  rowHeight?: number;
  enableSelection?: boolean;
  enableVirtual?: boolean;
  getRowId?: (row: T) => string;
  onSelectionChange?: (rows: T[]) => void;
  bulkArchive?: (rows: T[]) => void | Promise<void>;
  bulkRestore?: (rows: T[]) => void | Promise<void>;
  bulkDelete?: (rows: T[]) => void | Promise<void>;
  exportFilename?: string;
  emptyMessage?: string;
  toolbarExtra?: ReactNode;
  className?: string;
};

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function EnterpriseDataGrid<T extends { id?: string }>({
  data,
  columns,
  storageKey,
  height = 480,
  rowHeight = 44,
  enableSelection = true,
  enableVirtual = true,
  getRowId,
  onSelectionChange,
  bulkArchive,
  bulkRestore,
  bulkDelete,
  exportFilename = "export",
  emptyMessage = "No rows",
  toolbarExtra,
  className,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => (storageKey ? loadJson(`${storageKey}:vis`, {}) : {})
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(() => {
    if (storageKey) return loadJson(`${storageKey}:pin`, { left: [], right: [] });
    const left = columns
      .filter((c) => c.defaultPinned === "left")
      .map((c) => (typeof c.id === "string" ? c.id : (c as { accessorKey?: string }).accessorKey))
      .filter(Boolean) as string[];
    return { left: enableSelection ? ["__select", ...left] : left, right: [] };
  });
  const [savedFilterName, setSavedFilterName] = useState("");

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(`${storageKey}:vis`, JSON.stringify(columnVisibility));
  }, [columnVisibility, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(`${storageKey}:pin`, JSON.stringify(columnPinning));
  }, [columnPinning, storageKey]);

  const selectCol: ColumnDef<T, unknown> = useMemo(
    () => ({
      id: "__select",
      size: 40,
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
        />
      ),
    }),
    []
  );

  const allColumns = useMemo(
    () => (enableSelection ? [selectCol, ...columns] : columns),
    [columns, enableSelection, selectCol]
  );

  const table = useReactTable({
    data,
    columns: allColumns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnPinning,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: getRowId
      ? (row) => getRowId(row)
      : (row, i) => (row.id != null ? String(row.id) : String(i)),
    enableRowSelection: enableSelection,
    globalFilterFn: "includesString",
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);

  useEffect(() => {
    onSelectionChange?.(selectedRows);
  }, [selectedRows, onSelectionChange]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
    enabled: enableVirtual && rows.length > 40,
  });

  const virtualRows = enableVirtual && rows.length > 40 ? virtualizer.getVirtualItems() : null;
  const paddingTop = virtualRows?.length ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom = virtualRows?.length
    ? virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0)
    : 0;

  const exportSelected = useCallback(() => {
    const exportRows = selectedRows.length ? selectedRows : rows.map((r) => r.original);
    const visible = table.getVisibleLeafColumns().filter((c) => c.id !== "__select");
    const headers = visible.map((c) => String(c.columnDef.header ?? c.id));
    const body = exportRows.map((row) =>
      visible.map((col) => {
        const v = (row as Record<string, unknown>)[col.id];
        if (v == null) return "";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      })
    );
    downloadCsv(`${exportFilename}.csv`, headers, body);
  }, [exportFilename, rows, selectedRows, table]);

  const saveFilterPreset = () => {
    if (!storageKey || !savedFilterName.trim()) return;
    const presets = loadJson<Record<string, { global: string; columns: ColumnFiltersState }>>(
      `${storageKey}:filters`,
      {}
    );
    presets[savedFilterName.trim()] = {
      global: globalFilter,
      columns: columnFilters,
    };
    localStorage.setItem(`${storageKey}:filters`, JSON.stringify(presets));
    setSavedFilterName("");
  };

  const loadFilterPreset = (name: string) => {
    if (!storageKey) return;
    const presets = loadJson<Record<string, { global: string; columns: ColumnFiltersState }>>(
      `${storageKey}:filters`,
      {}
    );
    const p = presets[name];
    if (!p) return;
    setGlobalFilter(p.global || "");
    setColumnFilters(p.columns || []);
  };

  const filterPresets = storageKey
    ? Object.keys(loadJson<Record<string, unknown>>(`${storageKey}:filters`, {}))
    : [];

  const displayRows = virtualRows
    ? virtualRows.map((v) => rows[v.index]).filter(Boolean)
    : rows;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder="Search all columns…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Columns3 className="h-3.5 w-3.5 mr-1" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 max-h-72 overflow-y-auto">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((c) => c.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(v) => column.toggleVisibility(!!v)}
                >
                  {String(column.columnDef.header ?? column.id)}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" variant="outline" onClick={exportSelected}>
          <Download className="h-3.5 w-3.5 mr-1" />
          Export CSV
        </Button>

        {storageKey && (
          <div className="flex items-center gap-1">
            <Input
              className="h-9 w-28"
              placeholder="Filter name"
              value={savedFilterName}
              onChange={(e) => setSavedFilterName(e.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={saveFilterPreset}>
              <Filter className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
            {filterPresets.map((name) => (
              <Button
                key={name}
                size="sm"
                variant="ghost"
                onClick={() => loadFilterPreset(name)}
              >
                {name}
              </Button>
            ))}
          </div>
        )}

        <Badge variant="secondary" className="tabular-nums">
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </Badge>
        {toolbarExtra}
      </div>

      <BulkActionBar
        count={selectedRows.length}
        onClear={() => setRowSelection({})}
        onExport={exportSelected}
        onArchive={bulkArchive ? () => bulkArchive(selectedRows) : undefined}
        onRestore={bulkRestore ? () => bulkRestore(selectedRows) : undefined}
        onDelete={bulkDelete ? () => bulkDelete(selectedRows) : undefined}
      />

      <div
        ref={parentRef}
        className="table-shell relative"
        style={{ maxHeight: height, overflow: "auto" }}
      >
        <table className="w-full caption-bottom text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur border-b">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const pinned = header.column.getIsPinned();
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "h-10 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap",
                        pinned === "left" && "sticky left-0 z-20 bg-muted shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                      )}
                      style={{
                        width: header.getSize(),
                        left:
                          pinned === "left"
                            ? `${header.column.getStart("left")}px`
                            : undefined,
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1 hover:text-foreground",
                              header.column.getCanSort() && "cursor-pointer select-none"
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <>
                                {header.column.getIsSorted() === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5" />
                                ) : header.column.getIsSorted() === "desc" ? (
                                  <ArrowDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                                )}
                              </>
                            )}
                          </button>
                          {header.column.id !== "__select" && (
                            <button
                              type="button"
                              title="Pin column"
                              className="p-0.5 rounded hover:bg-background"
                              onClick={() =>
                                header.column.pin(
                                  header.column.getIsPinned() === "left" ? false : "left"
                                )
                              }
                            >
                              <Pin
                                className={cn(
                                  "h-3 w-3",
                                  header.column.getIsPinned()
                                    ? "text-accent"
                                    : "text-muted-foreground/50"
                                )}
                              />
                            </button>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={allColumns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: paddingTop }} colSpan={allColumns.length} />
                  </tr>
                )}
                {displayRows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      "border-b transition-colors hover:bg-muted/40",
                      row.getIsSelected() && "bg-accent/5"
                    )}
                    style={{ height: rowHeight }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const pinned = cell.column.getIsPinned();
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "px-3 py-2 align-middle",
                            pinned === "left" &&
                              "sticky left-0 z-[1] bg-card shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                          )}
                          style={{
                            width: cell.column.getSize(),
                            left:
                              pinned === "left"
                                ? `${cell.column.getStart("left")}px`
                                : undefined,
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: paddingBottom }} colSpan={allColumns.length} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
