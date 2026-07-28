"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitBranch, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatNumber } from "@/lib/utils";

export default function TraceabilityPage() {
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [balances, setBalances] = useState<Array<Record<string, unknown>>>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (q?: string) => {
    const supabase = createClient();
    let eq = supabase
      .from("batch_trace_events")
      .select("*, products(name, product_code), warehouses(name)")
      .order("event_at", { ascending: false })
      .limit(150);

    if (q) {
      eq = eq.or(
        `batch_number.ilike.%${q}%,serial_number.ilike.%${q}%,reference_number.ilike.%${q}%`
      );
    }

    let bq = supabase
      .from("stock_balances")
      .select(
        "batch_number, serial_number, manufacture_date, expiry_date, quality_certificate, supplier_batch, production_line, quantity_on_hand, products(name, product_code), warehouses(name)"
      )
      .not("batch_number", "is", null)
      .limit(100);

    if (q) {
      bq = bq.or(`batch_number.ilike.%${q}%,serial_number.ilike.%${q}%`);
    }

    const [{ data }, { data: bal }] = await Promise.all([eq, bq]);
    setEvents(data ?? []);
    setBalances(bal ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Batch & Serial Traceability"
        description="Serial · batch · MFD · expiry · production line · QC certs · supplier batch · supplier → customer"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/inventory">Hub</Link>
          </Button>
        }
      />

      <form
        className="flex gap-2 max-w-lg mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          load(search);
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Batch, serial, or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit">Trace</Button>
      </form>

      <h3 className="font-medium mb-2">Live batch positions</h3>
      {balances.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-6">No batch-tracked balances</p>
      ) : (
        <div className="rounded-lg border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch / Serial</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>MFD / Expiry</TableHead>
                <TableHead>Supplier batch</TableHead>
                <TableHead className="text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((b, i) => {
                const prod = b.products as { name?: string; product_code?: string } | null;
                const wh = b.warehouses as { name?: string } | null;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">
                      {String(b.batch_number ?? "—")}
                      {b.serial_number ? (
                        <div className="text-xs">{String(b.serial_number)}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {prod?.product_code} — {prod?.name}
                    </TableCell>
                    <TableCell>{wh?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {b.manufacture_date ? String(b.manufacture_date) : "—"} /{" "}
                      {b.expiry_date ? String(b.expiry_date) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {String(b.supplier_batch ?? "—")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(b.quantity_on_hand))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="font-medium mb-2">Trace events</h3>
      {events.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No trace events"
          description="Events are recorded on GRN receive, transfer, issue, and adjustments"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Batch / Serial</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => {
                const prod = e.products as { name?: string; product_code?: string } | null;
                const wh = e.warehouses as { name?: string } | null;
                return (
                  <TableRow key={String(e.id)}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {e.event_at ? formatDateTime(String(e.event_at)) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(e.event_type)} />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {String(e.batch_number ?? "—")}
                      {e.serial_number ? (
                        <div className="text-xs">{String(e.serial_number)}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {prod?.product_code ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {wh?.name ?? "—"}
                      {e.to_location ? (
                        <Badge variant="outline" className="ml-1 font-normal">
                          {String(e.to_location)}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(e.quantity || 1))}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {String(e.reference_number ?? "—")}
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
