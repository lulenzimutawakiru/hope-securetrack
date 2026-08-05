"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";

type Company = {
  id: string;
  name: string;
  code: string;
  tenant_id?: string | null;
  is_primary?: boolean;
  is_active?: boolean;
  base_currency?: string | null;
  country?: string | null;
  company_type?: string | null;
  tenants?: { name?: string; slug?: string; status?: string } | null;
};

export default function PlatformCompaniesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Company[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      qs.set("limit", "300");
      const res = await fetch(`/api/platform/companies?${qs}`);
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Failed to load companies");
      }
      setRows(json.data?.companies ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && rows.length === 0) {
    return <LoadingState message="Loading companies…" />;
  }

  return (
    <div>
      <PageHeader
        title="Company administration"
        description="Legal / operating entities across all tenants — layer 3 of the control plane"
        actions={
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        }
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search company name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <Button variant="secondary" onClick={load}>
          Search
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <p className="font-medium flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                    {c.name}
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {c.code}
                    {c.is_primary ? " · primary" : ""}
                  </p>
                </TableCell>
                <TableCell>
                  {c.tenant_id ? (
                    <Link
                      href={`/platform/tenants/${c.tenant_id}`}
                      className="text-sm hover:underline text-primary"
                    >
                      {c.tenants?.name || c.tenants?.slug || "Tenant"}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs capitalize">
                  {c.company_type || "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {c.base_currency || "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={c.is_active === false ? "outline" : "secondary"}
                    className="text-[10px]"
                  >
                    {c.is_active === false ? "inactive" : "active"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-sm text-muted-foreground py-10"
                >
                  No companies found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
