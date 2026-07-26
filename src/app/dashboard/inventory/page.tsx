"use client";

import { useEffect, useState } from "react";
import { Warehouse } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { Ream, Carton, InventoryMovement } from "@/types/database";

export default function InventoryPage() {
  const [reams, setReams] = useState<Ream[]>([]);
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ reams: 0, cartons: 0, production: 0 });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [
        { data: reamData },
        { data: cartonData },
        { data: moveData },
        reamCount,
        cartonCount,
        prodCount,
      ] = await Promise.all([
        supabase
          .from("reams")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("cartons")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("inventory_movements")
          .select("*")
          .order("performed_at", { ascending: false })
          .limit(50),
        supabase
          .from("reams")
          .select("*", { count: "exact", head: true })
          .eq("inventory_status", "in_warehouse"),
        supabase
          .from("cartons")
          .select("*", { count: "exact", head: true })
          .eq("inventory_status", "in_warehouse"),
        supabase
          .from("reams")
          .select("*", { count: "exact", head: true })
          .eq("inventory_status", "in_production"),
      ]);

      setReams((reamData as Ream[]) ?? []);
      setCartons((cartonData as Carton[]) ?? []);
      setMovements((moveData as InventoryMovement[]) ?? []);
      setStats({
        reams: reamCount.count ?? 0,
        cartons: cartonCount.count ?? 0,
        production: prodCount.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Warehouse stock, reams, cartons, and movement history"
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Warehouse Reams" value={formatNumber(stats.reams)} icon={Warehouse} />
        <StatCard title="Warehouse Cartons" value={formatNumber(stats.cartons)} />
        <StatCard title="In Production" value={formatNumber(stats.production)} />
      </div>

      <Tabs defaultValue="reams">
        <TabsList>
          <TabsTrigger value="reams">Reams</TabsTrigger>
          <TabsTrigger value="cartons">Cartons</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="reams" className="mt-4">
          {reams.length === 0 ? (
            <EmptyState icon={Warehouse} title="No reams in inventory" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>GSM</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reams.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.serial_number}</TableCell>
                      <TableCell>{r.paper_size}</TableCell>
                      <TableCell>{r.gsm}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.inventory_status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(r.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cartons" className="mt-4">
          {cartons.length === 0 ? (
            <EmptyState icon={Warehouse} title="No cartons in inventory" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial</TableHead>
                    <TableHead>Reams</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Packed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cartons.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{c.serial_number}</TableCell>
                      <TableCell>{c.ream_count}</TableCell>
                      <TableCell>{c.paper_size}</TableCell>
                      <TableCell>
                        <StatusBadge status={c.inventory_status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.packed_at ? formatDateTime(c.packed_at) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          {movements.length === 0 ? (
            <EmptyState title="No inventory movements" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="capitalize">
                        {m.movement_type.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="capitalize">{m.item_type}</TableCell>
                      <TableCell>{m.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {m.notes ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(m.performed_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
