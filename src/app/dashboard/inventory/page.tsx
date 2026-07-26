"use client";

import { useEffect, useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
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

export default function InventoryPage() {
  const { auth, hasPermission } = useUser();
  const [reams, setReams] = useState<Ream[]>([]);
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [warehouses, setWarehouses] = useState<
    { id: string; name: string; code: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    reams: 0,
    cartons: 0,
    production: 0,
    transit: 0,
  });
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

  const load = async () => {
    const supabase = createClient();
    let reamQ = supabase
      .from("reams")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    let cartonQ = supabase
      .from("cartons")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (statusFilter !== "all") {
      reamQ = reamQ.eq("inventory_status", statusFilter);
      cartonQ = cartonQ.eq("inventory_status", statusFilter);
    }

    const [
      { data: reamData },
      { data: cartonData },
      { data: moveData },
      { data: distData },
      { data: whData },
      reamCount,
      cartonCount,
      prodCount,
      transitCount,
    ] = await Promise.all([
      reamQ,
      cartonQ,
      supabase
        .from("inventory_movements")
        .select("*")
        .order("performed_at", { ascending: false })
        .limit(80),
      supabase.from("distributors").select("*").eq("is_active", true).order("name"),
      supabase.from("warehouses").select("id,name,code").eq("is_active", true),
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
      supabase
        .from("reams")
        .select("*", { count: "exact", head: true })
        .eq("inventory_status", "in_transit"),
    ]);

    setReams((reamData as Ream[]) ?? []);
    setCartons((cartonData as Carton[]) ?? []);
    setMovements((moveData as InventoryMovement[]) ?? []);
    setDistributors((distData as Distributor[]) ?? []);
    setWarehouses(whData ?? []);
    setStats({
      reams: reamCount.count ?? 0,
      cartons: cartonCount.count ?? 0,
      production: prodCount.count ?? 0,
      transit: transitCount.count ?? 0,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

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

  const handleMove = async (e: React.FormEvent) => {
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
      const supabase = createClient();
      const newStatus = resolveStatus(moveForm.action);
      const table = moveForm.itemType === "ream" ? "reams" : "cartons";
      const idField = moveForm.itemType === "ream" ? "ream_id" : "carton_id";

      const updates: Record<string, unknown> = {
        inventory_status: newStatus,
      };
      if (moveForm.warehouseId) {
        updates.warehouse_id = moveForm.warehouseId;
      }

      const { error } = await supabase.from(table).update(updates).in("id", ids);
      if (error) throw error;

      // Mirror status on linked QR codes where possible
      if (moveForm.itemType === "ream") {
        const { data: reamRows } = await supabase
          .from("reams")
          .select("qr_code_id")
          .in("id", ids);
        const qrIds = (reamRows ?? [])
          .map((r) => r.qr_code_id)
          .filter(Boolean) as string[];
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
            await supabase
              .from("qr_codes")
              .update({ status: qrStatus })
              .in("id", qrIds);
          }
        }
      }

      const movements = ids.map((id) => ({
        company_id: auth.profile.company_id,
        movement_type: moveForm.action,
        item_type: moveForm.itemType,
        [idField]: id,
        to_warehouse_id: moveForm.warehouseId || null,
        distributor_id: moveForm.distributorId || null,
        quantity: 1,
        notes: moveForm.notes || null,
        performed_by: auth.profile.id,
      }));

      const { error: moveErr } = await supabase
        .from("inventory_movements")
        .insert(movements);
      if (moveErr) throw moveErr;

      toast.success(
        `Updated ${ids.length} ${moveForm.itemType}${ids.length > 1 ? "s" : ""} → ${newStatus.replace(/_/g, " ")}`
      );
      setMoveOpen(false);
      setSelectedReams(new Set());
      setSelectedCartons(new Set());
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Move failed");
    } finally {
      setMoving(false);
    }
  };

  if (loading) return <LoadingState />;

  const canMove =
    hasPermission("inventory.move") || hasPermission("inventory.manage");

  return (
    <div>
      <PageHeader
        title="Inventory Control"
        description="Warehouse stock, transfers, distributor dispatch, and full movement history"
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
