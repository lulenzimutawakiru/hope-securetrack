"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, RotateCcw, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { RECYCLE_BIN_SOURCES, restoreRecord } from "@/lib/soft-delete";
import { toast } from "sonner";

type BinRow = {
  id: string;
  table: string;
  label: string;
  title: string;
  code?: string;
  module: string;
  deleted_at: string;
};

export default function RecycleBinPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BinRow[]>([]);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const collected: BinRow[] = [];

    await Promise.all(
      RECYCLE_BIN_SOURCES.map(async (src) => {
        try {
          const { data, error } = await supabase
            .from(src.table)
            .select("*")
            .not("deleted_at", "is", null)
            .order("deleted_at", { ascending: false })
            .limit(50);
          if (error || !data) return;
          for (const r of data) {
            const rec = r as Record<string, unknown>;
            collected.push({
              id: String(rec.id),
              table: src.table,
              label: src.label,
              title: String(rec[src.titleKey] ?? "—"),
              code: src.codeKey ? String(rec[src.codeKey] ?? "") : undefined,
              module: src.module,
              deleted_at: String(rec.deleted_at ?? ""),
            });
          }
        } catch {
          /* table may lack deleted_at */
        }
      })
    );

    collected.sort(
      (a, b) =>
        new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime()
    );
    setRows(collected);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const restore = async (row: BinRow) => {
    const supabase = createClient();
    const extra =
      row.table === "chart_of_accounts" || row.table === "products"
        ? { is_active: true }
        : undefined;
    const { error } = await restoreRecord(supabase, row.table, row.id, extra);
    if (error) toast.error(error.message);
    else {
      toast.success(`Restored ${row.title}`);
      load();
    }
  };

  const permanentHint = (row: BinRow) => {
    toast.message("Hard delete is restricted", {
      description: `${row.label} stays soft-deleted for audit. Contact DB admin for purge.`,
    });
  };

  const filtered =
    filter === "all" ? rows : rows.filter((r) => r.module === filter);

  const modules = Array.from(new Set(rows.map((r) => r.module)));

  if (loading) return <LoadingState message="Loading recycle bin…" />;

  return (
    <div>
      <PageHeader
        title="Recycle Bin"
        description="Soft-deleted records · restore · audit-safe archive (no silent hard delete)"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refresh
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">Workspace</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          All ({rows.length})
        </Button>
        {modules.map((m) => (
          <Button
            key={m}
            size="sm"
            variant={filter === m ? "default" : "outline"}
            className="capitalize"
            onClick={() => setFilter(m)}
          >
            {m}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Recycle bin is empty"
          description="Archived accounts, products, journals, and more appear here"
        />
      ) : (
        <div className="table-shell">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Deleted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={`${r.table}-${r.id}`}>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {r.module}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.label}</TableCell>
                  <TableCell className="font-mono text-xs">{r.code || "—"}</TableCell>
                  <TableCell className="font-medium text-sm">{r.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {r.deleted_at
                      ? new Date(r.deleted_at).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => restore(r)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => permanentHint(r)}
                      title="Hard delete restricted"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
