"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";

export default function IdentityPermissionsPage() {
  const [rows, setRows] = useState<
    Array<{ id: string; name: string; slug: string; module: string; description: string | null }>
  >([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("permissions")
        .select("*")
        .order("module")
        .order("slug");
      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.slug.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.module.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const modules = useMemo(
    () => Array.from(new Set(rows.map((r) => r.module))).sort(),
    [rows]
  );

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Permission Matrix"
        description="Granular Create · View · Edit · Delete · Approve · Export across ERP modules"
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {modules.map((m) => (
          <Badge key={m} variant="outline" className="capitalize">
            {m} ({rows.filter((r) => r.module === m).length})
          </Badge>
        ))}
      </div>

      <Input
        className="max-w-sm mb-4"
        placeholder="Filter permissions…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <EmptyState icon={KeyRound} title="No permissions" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {r.module}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.slug}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.description || "—"}
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
