"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, RefreshCw, Search, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import {
  listDomainContracts,
  type UnifiedContract,
} from "@/lib/contracts";
import { CONTRACT_DOMAINS, type ContractDomain } from "@/lib/contracts/types";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export function ContractList({ domain }: { domain: ContractDomain }) {
  const meta = CONTRACT_DOMAINS.find((d) => d.key === domain)!;
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UnifiedContract[]>([]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");

  const load = async () => {
    const cid = auth?.profile?.company_id;
    if (!cid) {
      setLoading(false);
      return;
    }
    try {
      setRows(await listDomainContracts(domain, cid, { status }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [auth, domain, status]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.contract_number.toLowerCase().includes(s) ||
        r.title.toLowerCase().includes(s) ||
        r.party.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s)
    );
  }, [rows, q]);

  if (loading) return <LoadingState message={`Loading ${meta.title}…`} />;

  return (
    <div>
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={meta.legacyHref}>
                <ExternalLink className="h-4 w-4 mr-1" /> Module view
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search number, title, party…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {["draft", "active", "expired", "terminated", "completed", "cancelled", "renewed"].map(
              (s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No contracts" description={`No ${meta.title.toLowerCase()} found.`} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={r.href}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {r.contract_number}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    <Link href={r.href} className="hover:underline">
                      {r.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm max-w-[160px] truncate">{r.party}</TableCell>
                  <TableCell className="text-xs capitalize">
                    {r.contract_type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {r.start_date ? formatDate(r.start_date) : "—"} →{" "}
                    {r.end_date ? formatDate(r.end_date) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatNumber(r.value)} {r.currency}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "active"
                          ? "default"
                          : r.status === "expired" || r.status === "terminated"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={r.href}>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
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
