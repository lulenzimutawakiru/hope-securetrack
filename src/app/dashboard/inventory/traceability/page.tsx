"use client";

import { useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { useEntityAll } from "@/hooks/use-entity-all";

const EM = "—";

export default function TraceabilityPage() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  // Reads flow through the hardened CRUD API: tenant/company are derived
  // server-side, every row is permission-checked (inventory.view) and
  // dual-key scoped. Trace events are searched server-side via the entity's
  // searchable columns; batch-tracked balances are filtered client-side
  // because the CRUD engine only supports equality filters. Product labels
  // resolve from the RLS-bound browser client (products.view vs the
  // inventory.view gate here).
  const eventsQ = useEntityAll<Record<string, unknown>>("batch_trace_events", {
    search: q || undefined,
    sort: "event_at",
    order: "desc",
    max: 150,
  });
  const balancesQ = useEntityAll<Record<string, unknown>>("stock_balances", {
    sort: "updated_at",
    order: "desc",
    max: 500,
  });
  const warehousesQ = useEntityAll<{ id: string; name: string }>("warehouses", {
    select: "id,name",
  });
  const productsQ = useQuery({
    queryKey: ["traceability", "products-reference"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id,name,product_code");
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        name: string;
        product_code: string;
      }>;
    },
  });

  const events = eventsQ.data ?? [];
  const warehouses = warehousesQ.data ?? [];
  const products = productsQ.data ?? [];
  const warehousesMap = new Map(warehouses.map((w) => [w.id, w.name]));
  const productsMap = new Map(products.map((p) => [p.id, p]));
  const productCode = (id: string | null | undefined) =>
    productsMap.get(id ?? "")?.product_code ?? EM;
  const productLabel = (id: string | null | undefined) => {
    const p = productsMap.get(id ?? "");
    return p ? `${p.product_code} ${EM} ${p.name}` : EM;
  };
  const term = q.trim().toLowerCase();
  const balances = (balancesQ.data ?? []).filter(
    (b) =>
      b.batch_number != null &&
      (!term ||
        String(b.batch_number ?? "").toLowerCase().includes(term) ||
        String(b.serial_number ?? "").toLowerCase().includes(term))
  );

  const loading =
    eventsQ.isPending ||
    balancesQ.isPending ||
    warehousesQ.isPending ||
    productsQ.isPending;

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
          setQ(search);
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
              {balances.map((b, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-sm">
                    {String(b.batch_number ?? EM)}
                    {b.serial_number ? (
                      <div className="text-xs">{String(b.serial_number)}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>{productLabel(b.product_id as string)}</TableCell>
                  <TableCell>
                    {warehousesMap.get(b.warehouse_id as string) ?? EM}
                  </TableCell>
                  <TableCell className="text-sm">
                    {b.manufacture_date ? String(b.manufacture_date) : EM} /{" "}
                    {b.expiry_date ? String(b.expiry_date) : EM}
                  </TableCell>
                  <TableCell className="text-sm">
                    {String(b.supplier_batch ?? EM)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(b.quantity_on_hand))}
                  </TableCell>
                </TableRow>
              ))}
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
              {events.map((e) => (
                <TableRow key={String(e.id)}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {e.event_at ? formatDateTime(String(e.event_at)) : EM}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={String(e.event_type)} />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {String(e.batch_number ?? EM)}
                    {e.serial_number ? (
                      <div className="text-xs">{String(e.serial_number)}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {productCode(e.product_id as string)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {warehousesMap.get(e.warehouse_id as string) ?? EM}
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
                    {String(e.reference_number ?? EM)}
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
