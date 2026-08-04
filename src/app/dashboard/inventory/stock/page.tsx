"use client";

import { useState, type FormEvent } from "react";
import {
  Warehouse,
  ArrowRightLeft,
  Truck,
  PackageCheck,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { useEntityAll } from "@/hooks/use-entity-all";
import { useEntityList } from "@/hooks/use-entity-query";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { entityKeys } from "@/lib/api/query-keys";
import type {
  Ream,
  Carton,
  InventoryMovement,
  Distributor,
} from "@/types/database";

const INVENTORY_STATUSES = [
  "in_production",
  "in_warehouse",
  "in_transit",
  "at_distributor",
  "at_retailer",
  "sold",
  "returned",
  "recalled",
  "destroyed",
] as const;

type ItemKind = "ream" | "carton";

export default function SerializedStockPage() {
  const { auth, hasPermission } = useUser();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReams, setSelectedReams] = useState<Set<string>>(new Set());
  const [selectedCartons, setSelectedCartons] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveForm, setMoveForm] = useState({
    itemType: "ream" as ItemKind,
    action: "receive_warehouse",
    warehouseId: "",
    distributorId: "",
    notes: "",
  });

  // Reads flow through the hardened CRUD API: tenant/company are derived
  // server-side, every row is permission-checked and dual-key (tenant +
  // company) scoped. The status filter is composed into the query params so
  // the cache key changes on filter switch and invalidation stays aligned.
  const statusFilterQuery =
    statusFilter === "all" ? undefined : { inventory_status: statusFilter };

  const reamsQ = useEntityAll<Ream>("reams", {
    max: 200,
    sort: "created_at",
    order: "desc",
    filters: statusFilterQuery,
  });
  const cartonsQ = useEntityAll<Carton>("cartons", {
    max: 200,
    sort: "created_at",
    order: "desc",
    filters: statusFilterQuery,
  });
  const movementsQ = useEntityAll<InventoryMovement>("inventory_movements", {
    max: 80,
    sort: "performed_at",
    order: "desc",
  });
  const warehousesQ = useEntityAll<{ id: string; name: string; code: string }>(
    "warehouses",
    { select: "id,name,code", filters: { is_active: true } }
  );

  // Distributors are a cross-module reference whose CRUD read gate is
  // crm.view; the inventory warehouse roles that drive this page hold
  // distributors.view instead, so this read stays on the RLS-bound browser
  // client (company-scoped policy) to keep the dispatch dropdown working.
  const distributorsQ = useQuery({
    queryKey: ["stock", "distributors-reference"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("distributors")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Distributor[];
    },
  });

  // Head-count stats use the server-side exact total from the CRUD API.
  const reamsWhQ = useEntityList<Ream>("reams", {
    pageSize: 1,
    filters: { inventory_status: "in_warehouse" },
  });
  const cartonsWhQ = useEntityList<Carton>("cartons", {
    pageSize: 1,
    filters: { inventory_status: "in_warehouse" },
  });
  const prodQ = useEntityList<Ream>("reams", {
    pageSize: 1,
    filters: { inventory_status: "in_production" },
  });
  const transitQ = useEntityList<Ream>("reams", {
    pageSize: 1,
    filters: { inventory_status: "in_transit" },
  });

  const reams = reamsQ.data ?? [];
  const cartons = cartonsQ.data ?? [];
  const movements = movementsQ.data ?? [];
  const warehouses = warehousesQ.data ?? [];
  const distributors = distributorsQ.data ?? [];
  const stats = {
    reams: reamsWhQ.data?.total ?? 0,
    cartons: cartonsWhQ.data?.total ?? 0,
    production: prodQ.data?.total ?? 0,
    transit: transitQ.data?.total ?? 0,
  };
  const loading =
    reamsQ.isPending ||
    cartonsQ.isPending ||
    movementsQ.isPending ||
    warehousesQ.isPending ||
    distributorsQ.isPending ||
    reamsWhQ.isPending ||
    cartonsWhQ.isPending ||
    prodQ.isPending ||
    transitQ.isPending;
  const listError =
    reamsQ.error ?? cartonsQ.error ?? movementsQ.error ?? warehousesQ.error;

  const filterSerial = <T extends { serial_number: string }>(items: T[]) => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter((i) => i.serial_number.toLowerCase().includes(s));
  };

  const toggle = (kind: ItemKind, id: string) => {
    const set = kind === "ream" ? setSelectedReams : setSelectedCartons;
    set((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resolveStatus = (action: string) => {
    switch (action) {
      case "receive_warehouse":
        return "in_warehouse";
      case "dispatch_distributor":
        return "in_transit";
      case "arrive_distributor":
        return "at_distributor";
      case "retail":
        return "at_retailer";
      case "sold":
        return "sold";
      case "return":
        return "returned";
      case "recall":
        return "recalled";
      default:
        return "in_warehouse";
    }
  };

  const handleMove = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!auth) return;

    const ids =
      moveForm.itemType === "ream"
        ? Array.from(selectedReams)
        : Array.from(selectedCartons);

    if (ids.length === 0) {
      toast.error("Select items first");
      return;
    }

    if (
      moveForm.action === "receive_warehouse" &&
      !moveForm.warehouseId &&
      warehouses.length > 0
    ) {
      toast.error("Select a warehouse");
      return;
    }

    if (
      (moveForm.action === "dispatch_distributor" ||
        moveForm.action === "arrive_distributor") &&
      !moveForm.distributorId
    ) {
      toast.error("Select a distributor");
      return;
    }

    setMoving(true);
    try {
      const newStatus = resolveStatus(moveForm.action);
      const isReam = moveForm.itemType === "ream";
      const entity = isReam ? "reams" : "cartons";
      const idField = isReam ? "ream_id" : "carton_id";

      // Status + warehouse updates flow through the hardened CRUD API
      // (permission-checked, session-derived tenant/company, audited).
      const updates: Record<string, unknown> = { inventory_status: newStatus };
      if (moveForm.warehouseId) updates.warehouse_id = moveForm.warehouseId;

      const results = await Promise.all(
        ids.map((id) => crudUpdate(entity, id, updates))
      );
      const failed = results.find((r) => !r.ok);
      if (failed) throw new Error(failed.error);

      // Mirror status on linked QR codes where possible. Best-effort: the
      // qr_codes RLS update policy is restricted to QR/production roles, so
      // denials are tolerated (matches the legacy silent behavior).
      if (isReam) {
        const qrIds = ids
          .map((id) => reams.find((r) => r.id === id)?.qr_code_id)
          .filter((v): v is string => Boolean(v));
        if (qrIds.length) {
          const qrStatus =
            newStatus === "in_warehouse"
              ? "packed"
              : newStatus === "in_transit" || newStatus === "at_distributor"
                ? "dispatched"
                : newStatus === "sold"
                  ? "sold"
                  : newStatus === "recalled"
                    ? "recalled"
                    : undefined;
          if (qrStatus) {
            const qrResults = await Promise.allSettled(
              qrIds.map((qrId) =>
                crudUpdate("qr_codes", qrId, { status: qrStatus })
              )
            );
            const qrFailures = qrResults.filter(
              (r) =>
                r.status === "rejected" ||
                (r.status === "fulfilled" && !r.value.ok)
            );
            if (qrFailures.length > 0) {
              console.warn(
                "[stock] QR mirror failed for " +
                  qrFailures.length +
                  "/" +
                  qrIds.length +
                  " code(s)",
                qrFailures
              );
            }
          }
        }
      }

      const movements = ids.map((id) => ({
        movement_type: moveForm.action,
        item_type: moveForm.itemType,
        [idField]: id,
        to_warehouse_id: moveForm.warehouseId || null,
        distributor_id: moveForm.distributorId || null,
        quantity: 1,
        notes: moveForm.notes || null,
        performed_by: auth.profile.id,
      }));

      for (const mv of movements) {
        const crudRes = await crudCreate("inventory_movements", mv);
        if (!crudRes.ok) throw new Error(crudRes.error);
      }

      queryClient.invalidateQueries({ queryKey: entityKeys.entity("reams") });
      queryClient.invalidateQueries({ queryKey: entityKeys.entity("cartons") });
      queryClient.invalidateQueries({
        queryKey: entityKeys.entity("inventory_movements"),
      });
      queryClient.invalidateQueries({ queryKey: entityKeys.entity("qr_codes") });

      toast.success(
        `Updated ${ids.length} ${moveForm.itemType}${ids.length > 1 ? "s" : ""} → ${newStatus.replace(/_/g, " ")}`
      );
      setMoveOpen(false);
      setSelectedReams(new Set());
      setSelectedCartons(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Move failed");
    } finally {
      setMoving(false);
    }
  };

  if (loading) return <LoadingState />;

  if (listError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load stock: {listError.message}
      </div>
    );
  }

  const canMove =
    hasPermission("inventory.move") || hasPermission("inventory.manage");

  return (
    <div>
      <PageHeader
        title="Serialized Stock"
        description="Reams, cartons & QR chain of custody · warehouse receive · distributor dispatch"
        actions={
          canMove && (
            <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
              <DialogTrigger asChild>
                <Button>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Move / Dispatch
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleMove}>
                  <DialogHeader>
                    <DialogTitle>Inventory movement</DialogTitle>
                    <DialogDescription>
                      Apply status change to selected reams or cartons
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Item type</Label>
                      <Select
                        value={moveForm.itemType}
                        onValueChange={(v) =>
                          setMoveForm({
                            ...moveForm,
                            itemType: v as ItemKind,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ream">
                            Reams ({selectedReams.size} selected)
                          </SelectItem>
                          <SelectItem value="carton">
                            Cartons ({selectedCartons.size} selected)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Action</Label>
                      <Select
                        value={moveForm.action}
                        onValueChange={(v) =>
                          setMoveForm({ ...moveForm, action: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="receive_warehouse">
                            Receive into warehouse
                          </SelectItem>
                          <SelectItem value="dispatch_distributor">
                            Dispatch to distributor
                          </SelectItem>
                          <SelectItem value="arrive_distributor">
                            Arrive at distributor
                          </SelectItem>
                          <SelectItem value="retail">
                            Send to retailer
                          </SelectItem>
                          <SelectItem value="sold">Mark sold</SelectItem>
                          <SelectItem value="return">Return</SelectItem>
                          <SelectItem value="recall">Recall</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(moveForm.action === "receive_warehouse" ||
                      moveForm.action === "dispatch_distributor") && (
                      <div className="space-y-2">
                        <Label>Warehouse</Label>
                        <Select
                          value={moveForm.warehouseId}
                          onValueChange={(v) =>
                            setMoveForm({ ...moveForm, warehouseId: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select warehouse" />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouses.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name} ({w.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {(moveForm.action === "dispatch_distributor" ||
                      moveForm.action === "arrive_distributor") && (
                      <div className="space-y-2">
                        <Label>Distributor</Label>
                        <Select
                          value={moveForm.distributorId}
                          onValueChange={(v) =>
                            setMoveForm({ ...moveForm, distributorId: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select distributor" />
                          </SelectTrigger>
                          <SelectContent>
                            {distributors.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name} ({d.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Input
                        value={moveForm.notes}
                        onChange={(e) =>
                          setMoveForm({ ...moveForm, notes: e.target.value })
                        }
                        placeholder="Reference / waybill"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={moving}>
                      {moving ? "Processing…" : "Apply movement"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard
          title="Warehouse reams"
          value={formatNumber(stats.reams)}
          icon={Warehouse}
        />
        <StatCard
          title="Warehouse cartons"
          value={formatNumber(stats.cartons)}
          icon={PackageCheck}
        />
        <StatCard
          title="In production"
          value={formatNumber(stats.production)}
        />
        <StatCard
          title="In transit"
          value={formatNumber(stats.transit)}
          icon={Truck}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search serial…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {INVENTORY_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="reams">
        <TabsList>
          <TabsTrigger value="reams">
            Reams ({filterSerial(reams).length})
          </TabsTrigger>
          <TabsTrigger value="cartons">
            Cartons ({filterSerial(cartons).length})
          </TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="reams" className="mt-4">
          {filterSerial(reams).length === 0 ? (
            <EmptyState icon={Warehouse} title="No reams match" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {canMove && <TableHead className="w-10" />}
                    <TableHead>Serial</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>GSM</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterSerial(reams).map((r) => (
                    <TableRow key={r.id}>
                      {canMove && (
                        <TableCell>
                          <Checkbox
                            checked={selectedReams.has(r.id)}
                            onCheckedChange={() => toggle("ream", r.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-sm">
                        {r.serial_number}
                      </TableCell>
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
          {filterSerial(cartons).length === 0 ? (
            <EmptyState icon={Warehouse} title="No cartons match" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {canMove && <TableHead className="w-10" />}
                    <TableHead>Serial</TableHead>
                    <TableHead>Reams</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Packed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterSerial(cartons).map((c) => (
                    <TableRow key={c.id}>
                      {canMove && (
                        <TableCell>
                          <Checkbox
                            checked={selectedCartons.has(c.id)}
                            onCheckedChange={() => toggle("carton", c.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-sm">
                        {c.serial_number}
                      </TableCell>
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
            <EmptyState title="No inventory movements yet" />
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
