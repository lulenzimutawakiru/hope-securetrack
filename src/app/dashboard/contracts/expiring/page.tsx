"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { listExpiringContracts, type UnifiedContract } from "@/lib/contracts";
import { formatDate, formatNumber } from "@/lib/utils";

export default function ExpiringContractsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UnifiedContract[]>([]);

  const load = async () => {
    const cid = auth?.profile?.company_id;
    if (!cid) {
      setLoading(false);
      return;
    }
    try {
      setRows(await listExpiringContracts(cid, 90));
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [auth]);

  if (loading) return <LoadingState message="Loading expiring contracts…" />;

  return (
    <div>
      <PageHeader
        title="Expiring & expired contracts"
        description="Agreements ending within 90 days or already past end date"
        actions={
          <Button size="sm" variant="outline" onClick={() => load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Nothing expiring soon"
          description="No contracts end within the next 90 days."
        />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>End date</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const past = r.end_date ? new Date(r.end_date) < new Date() : false;
                return (
                  <TableRow key={`${r.domain}-${r.id}`}>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {r.domain}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={r.href} className="font-mono text-xs text-primary hover:underline">
                        {r.contract_number}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {r.title}
                    </TableCell>
                    <TableCell className="text-sm max-w-[140px] truncate">{r.party}</TableCell>
                    <TableCell className="text-xs">
                      {r.end_date ? formatDate(r.end_date) : "—"}
                      {past ? (
                        <Badge variant="destructive" className="ml-2">
                          past
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="ml-2">
                          soon
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatNumber(r.value)} {r.currency}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={r.href}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
